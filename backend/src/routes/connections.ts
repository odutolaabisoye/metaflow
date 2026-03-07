import type { FastifyInstance } from "fastify";
import crypto from "crypto";

// ─── Meta OAuth constants ─────────────────────────────────────────────────────
const META_GRAPH_VERSION = "v19.0";
const META_OAUTH_URL = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`;
const META_TOKEN_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`;
const META_SCOPES = ["ads_read", "ads_management", "catalog_management", "business_management"].join(",");

// ─── Shopify OAuth constants ──────────────────────────────────────────────────
const SHOPIFY_SCOPES = "read_products,read_orders,read_inventory,write_products";

// ─── State helpers ────────────────────────────────────────────────────────────
interface OAuthState {
  userId: string;
  storeId: string;
}

function encodeState(data: OAuthState): string {
  return Buffer.from(JSON.stringify(data)).toString("base64url");
}

function decodeState(state: string): OAuthState | null {
  try {
    return JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as OAuthState;
  } catch {
    return null;
  }
}

export async function connectionRoutes(app: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════════════════════
  // GET /connections
  // List all connections for the authenticated user's stores.
  // ═══════════════════════════════════════════════════════════════════════════
  app.get("/connections", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();

      const stores = await app.prisma.store.findMany({
        where: { ownerId: payload.sub },
        select: {
          id: true,
          name: true,
          platform: true,
          connections: {
            select: {
              id: true,
              provider: true,
              scopes: true,
              expiresAt: true,
              createdAt: true,
              updatedAt: true
            }
          }
        }
      });

      return reply.send({ ok: true, stores });
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DELETE /connections/:connectionId
  // Disconnects a provider connection.
  // ═══════════════════════════════════════════════════════════════════════════
  app.delete("/connections/:connectionId", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      const { connectionId } = request.params as { connectionId: string };

      const connection = await app.prisma.connection.findFirst({
        where: { id: connectionId },
        include: { store: { select: { ownerId: true } } }
      });

      if (!connection || connection.store.ownerId !== payload.sub) {
        return reply.code(404).send({ ok: false, message: "Connection not found" });
      }

      await app.prisma.connection.delete({ where: { id: connectionId } });

      return reply.send({ ok: true });
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // META OAUTH
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /connections/meta/auth?storeId=xxx
   * Redirects browser to Meta's OAuth authorization page.
   */
  app.get("/connections/meta/auth", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      const query = request.query as { storeId?: string };
      const storeId = query.storeId?.trim();

      if (!storeId) {
        return reply.code(400).send({ ok: false, message: "storeId is required" });
      }

      const store = await app.prisma.store.findFirst({
        where: { id: storeId, ownerId: payload.sub }
      });
      if (!store) {
        return reply.code(404).send({ ok: false, message: "Store not found" });
      }

      const appId = app.config.META_APP_ID;
      if (!appId) {
        return reply.code(503).send({ ok: false, message: "Meta integration not configured" });
      }

      const redirectUri = `${app.config.APP_URL}/v1/connections/meta/callback`;
      const state = encodeState({ userId: payload.sub, storeId });

      const authUrl = new URL(META_OAUTH_URL);
      authUrl.searchParams.set("client_id", appId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("scope", META_SCOPES);
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("response_type", "code");

      return reply.redirect(authUrl.toString());
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });

  /**
   * GET /connections/meta/callback?code=xxx&state=xxx
   * Exchanges authorization code for a long-lived token and persists the connection.
   */
  app.get("/connections/meta/callback", async (request, reply) => {
    const query = request.query as {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };
    const frontendBase = app.config.CORS_ORIGIN;

    if (query.error) {
      app.log.warn({ error: query.error }, "Meta OAuth denied by user");
      return reply.redirect(
        `${frontendBase}/app/settings?meta_error=${encodeURIComponent(query.error_description ?? query.error)}`
      );
    }

    const code = query.code?.trim();
    const rawState = query.state?.trim();

    if (!code || !rawState) {
      return reply.redirect(`${frontendBase}/app/settings?meta_error=missing_params`);
    }

    const state = decodeState(rawState);
    if (!state) {
      return reply.redirect(`${frontendBase}/app/settings?meta_error=invalid_state`);
    }

    const appId = app.config.META_APP_ID;
    const appSecret = app.config.META_APP_SECRET;
    const redirectUri = `${app.config.APP_URL}/v1/connections/meta/callback`;

    try {
      // Exchange short-lived code for access token
      const tokenRes = await fetch(
        `${META_TOKEN_URL}?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`
      );

      if (!tokenRes.ok) {
        app.log.error({ body: await tokenRes.text() }, "Meta token exchange failed");
        return reply.redirect(`${frontendBase}/app/settings?meta_error=token_exchange_failed`);
      }

      const tokenData = (await tokenRes.json()) as {
        access_token: string;
        token_type: string;
        expires_in?: number;
      };
      const shortToken = tokenData.access_token;

      // Exchange for a long-lived token (valid ~60 days)
      const longTokenRes = await fetch(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`
      );

      let accessToken = shortToken;
      let expiresAt: Date | null = null;

      if (longTokenRes.ok) {
        const longData = (await longTokenRes.json()) as {
          access_token: string;
          expires_in?: number;
        };
        accessToken = longData.access_token;
        if (longData.expires_in) {
          expiresAt = new Date(Date.now() + longData.expires_in * 1000);
        }
      }

      // Upsert the Meta connection
      await app.prisma.connection.upsert({
        where: { storeId_provider: { storeId: state.storeId, provider: "META" } },
        create: {
          provider: "META",
          accessToken,
          expiresAt,
          scopes: META_SCOPES,
          storeId: state.storeId
        },
        update: {
          accessToken,
          expiresAt,
          scopes: META_SCOPES,
          refreshToken: null
        }
      });

      await app.prisma.auditLog.create({
        data: {
          action: "Meta Connected",
          detail: "Meta Ads account connected via OAuth",
          metadata: { provider: "META", variant: "default", tag: "Info" },
          storeId: state.storeId
        }
      });

      // Kick off initial Meta sync
      await app.queues.syncQueue.add(
        "meta-sync",
        { storeId: state.storeId, provider: "META", accessToken },
        { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
      );

      return reply.redirect(`${frontendBase}/app/settings?meta_connected=1`);
    } catch (err) {
      app.log.error({ err }, "Meta OAuth callback error");
      return reply.redirect(`${frontendBase}/app/settings?meta_error=server_error`);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SHOPIFY OAUTH
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /connections/shopify/auth?storeId=xxx&shop=mystore.myshopify.com
   * Redirects browser to Shopify's OAuth authorization page.
   */
  app.get("/connections/shopify/auth", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      const { storeId, shop: rawShop } = request.query as { storeId?: string; shop?: string };

      if (!storeId || !rawShop) {
        return reply.code(400).send({ ok: false, message: "storeId and shop are required" });
      }

      const store = await app.prisma.store.findFirst({
        where: { id: storeId, ownerId: payload.sub }
      });
      if (!store) {
        return reply.code(404).send({ ok: false, message: "Store not found" });
      }

      const apiKey = app.config.SHOPIFY_API_KEY;
      if (!apiKey) {
        return reply.code(503).send({ ok: false, message: "Shopify integration not configured" });
      }

      const shop = rawShop.replace(/https?:\/\//, "").replace(/\/$/, "");
      const redirectUri = `${app.config.APP_URL}/v1/connections/shopify/callback`;
      const state = encodeState({ userId: payload.sub, storeId });

      const authUrl =
        `https://${shop}/admin/oauth/authorize` +
        `?client_id=${apiKey}` +
        `&scope=${SHOPIFY_SCOPES}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&state=${state}`;

      return reply.redirect(authUrl);
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });

  /**
   * GET /connections/shopify/callback?code=xxx&hmac=xxx&shop=xxx&state=xxx
   * Verifies HMAC signature, exchanges code for permanent token, registers webhooks.
   */
  app.get("/connections/shopify/callback", async (request, reply) => {
    const frontendBase = app.config.CORS_ORIGIN;
    const query = request.query as Record<string, string>;

    // --- HMAC verification (Shopify security requirement) ---
    const { hmac, ...rest } = query;
    if (!hmac) {
      return reply.redirect(`${frontendBase}/app/settings?shopify_error=missing_hmac`);
    }

    const message = Object.keys(rest)
      .sort()
      .map((k) => `${k}=${rest[k]}`)
      .join("&");

    const expectedHmac = crypto
      .createHmac("sha256", app.config.SHOPIFY_API_SECRET)
      .update(message)
      .digest("hex");

    // Constant-time comparison to prevent timing attacks
    let isValid = false;
    try {
      isValid =
        hmac.length === expectedHmac.length &&
        crypto.timingSafeEqual(Buffer.from(hmac, "hex"), Buffer.from(expectedHmac, "hex"));
    } catch {
      isValid = false;
    }

    if (!isValid) {
      app.log.warn({ shop: query.shop }, "Shopify HMAC verification failed");
      return reply.redirect(`${frontendBase}/app/settings?shopify_error=invalid_hmac`);
    }

    const state = decodeState(query.state);
    if (!state) {
      return reply.redirect(`${frontendBase}/app/settings?shopify_error=invalid_state`);
    }

    const shop = query.shop;
    const code = query.code;

    try {
      // Exchange authorization code for permanent access token
      const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: app.config.SHOPIFY_API_KEY,
          client_secret: app.config.SHOPIFY_API_SECRET,
          code
        })
      });

      if (!tokenRes.ok) {
        app.log.error({ body: await tokenRes.text() }, "Shopify token exchange failed");
        return reply.redirect(`${frontendBase}/app/settings?shopify_error=token_exchange_failed`);
      }

      const tokenData = (await tokenRes.json()) as {
        access_token: string;
        scope: string;
      };

      // Upsert the Shopify connection
      await app.prisma.connection.upsert({
        where: { storeId_provider: { storeId: state.storeId, provider: "SHOPIFY" } },
        create: {
          provider: "SHOPIFY",
          accessToken: tokenData.access_token,
          scopes: tokenData.scope,
          storeId: state.storeId
        },
        update: {
          accessToken: tokenData.access_token,
          scopes: tokenData.scope
        }
      });

      // Update store URL with the actual Shopify domain
      await app.prisma.store.update({
        where: { id: state.storeId },
        data: { storeUrl: `https://${shop}` }
      });

      // Register webhooks (non-fatal if they fail)
      await registerShopifyWebhooks(
        shop,
        tokenData.access_token,
        app.config.APP_URL
      );

      await app.prisma.auditLog.create({
        data: {
          action: "Shopify Connected",
          detail: `Shopify store ${shop} connected`,
          metadata: { provider: "SHOPIFY", shop, variant: "default", tag: "Info" },
          storeId: state.storeId
        }
      });

      // Enqueue initial full sync
      await app.queues.syncQueue.add(
        "shopify-sync",
        {
          storeId: state.storeId,
          provider: "SHOPIFY",
          shop,
          accessToken: tokenData.access_token
        },
        { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
      );

      // Enqueue scoring after sync completes (30s delay)
      await app.queues.scoringQueue.add(
        "score-store",
        { storeId: state.storeId },
        { delay: 30000, attempts: 2 }
      );

      return reply.redirect(`${frontendBase}/app/settings?shopify_connected=1`);
    } catch (err) {
      app.log.error({ err }, "Shopify callback error");
      return reply.redirect(`${frontendBase}/app/settings?shopify_error=server_error`);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WOOCOMMERCE (Manual credentials — WooCommerce uses consumer key/secret)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /connections/woocommerce
   * Manually connect a WooCommerce store using consumer key + secret.
   * Validates credentials by making a test API call before saving.
   *
   * Body: { storeId, consumerKey, consumerSecret }
   */
  app.post("/connections/woocommerce", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      const body = request.body as {
        storeId?: string;
        consumerKey?: string;
        consumerSecret?: string;
      };

      const { storeId, consumerKey, consumerSecret } = body ?? {};

      if (!storeId || !consumerKey || !consumerSecret) {
        return reply.code(400).send({
          ok: false,
          message: "storeId, consumerKey, and consumerSecret are required"
        });
      }

      const store = await app.prisma.store.findFirst({
        where: { id: storeId, ownerId: payload.sub }
      });

      if (!store) {
        return reply.code(404).send({ ok: false, message: "Store not found" });
      }

      // Verify credentials by calling the WooCommerce system status endpoint
      const testUrl = `${store.storeUrl.replace(/\/$/, "")}/wp-json/wc/v3/system_status`;
      const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

      const testRes = await fetch(testUrl, {
        headers: { Authorization: `Basic ${credentials}` }
      });

      if (!testRes.ok) {
        return reply.code(400).send({
          ok: false,
          message: "Could not connect to WooCommerce — verify your store URL and credentials"
        });
      }

      // Store credentials as "key:secret" (parsed by sync job)
      const accessToken = `${consumerKey}:${consumerSecret}`;

      await app.prisma.connection.upsert({
        where: { storeId_provider: { storeId, provider: "WOOCOMMERCE" } },
        create: {
          provider: "WOOCOMMERCE",
          accessToken,
          scopes: "read_write",
          storeId
        },
        update: {
          accessToken,
          scopes: "read_write"
        }
      });

      await app.prisma.auditLog.create({
        data: {
          action: "WooCommerce Connected",
          detail: `WooCommerce store connected at ${store.storeUrl}`,
          metadata: { provider: "WOOCOMMERCE", variant: "default", tag: "Info" },
          storeId
        }
      });

      // Enqueue initial sync
      await app.queues.syncQueue.add(
        "woocommerce-sync",
        { storeId, provider: "WOOCOMMERCE", storeUrl: store.storeUrl, accessToken },
        { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
      );

      await app.queues.scoringQueue.add(
        "score-store",
        { storeId },
        { delay: 30000, attempts: 2 }
      );

      return reply.code(201).send({ ok: true });
    } catch (err) {
      app.log.error({ err }, "WooCommerce connection error");
      return reply.code(500).send({ ok: false, message: "Internal server error" });
    }
  });
}

// ─── Shopify Webhook Registration ─────────────────────────────────────────────

const SHOPIFY_WEBHOOKS = [
  { topic: "products/create", path: "/webhooks/shopify/products/create" },
  { topic: "products/update", path: "/webhooks/shopify/products/update" },
  { topic: "products/delete", path: "/webhooks/shopify/products/delete" },
  { topic: "orders/create", path: "/webhooks/shopify/orders/create" }
];

async function registerShopifyWebhooks(
  shop: string,
  accessToken: string,
  appUrl: string
): Promise<void> {
  for (const webhook of SHOPIFY_WEBHOOKS) {
    try {
      await fetch(`https://${shop}/admin/api/2024-04/webhooks.json`, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          webhook: {
            topic: webhook.topic,
            address: `${appUrl}/v1${webhook.path}`,
            format: "json"
          }
        })
      });
    } catch (err) {
      // Non-fatal — webhooks can be re-registered at any time
      console.warn(`Failed to register Shopify webhook ${webhook.topic}:`, err);
    }
  }
}
