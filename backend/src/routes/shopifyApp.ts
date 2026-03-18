/**
 * Shopify App Routes
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles the Shopify App Store installation flow.
 * Philosophy: the Shopify app is integration-only — OAuth, webhooks, and a
 * thin redirect bridge. All data management lives on the MetaFlow dashboard.
 *
 * Routes (no /v1 prefix — registered directly at the root):
 *   GET  /shopify/install          App install entry point (from Shopify App Store)
 *   GET  /shopify/callback         OAuth callback → creates/links user + store
 *   POST /shopify/webhooks/uninstall  App uninstalled webhook
 *
 * Install flow:
 *   Shopify → /shopify/install → Shopify OAuth → /shopify/callback
 *   → find/create MetaFlow user & store → set session cookies
 *   → redirect to MetaFlow dashboard
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { FastifyInstance } from "fastify";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { registerShopifyWebhooks } from "./connections.js";

const SHOPIFY_API_VERSION = "2024-04";
const SHOPIFY_SCOPES = "read_products,read_orders,read_inventory,write_products";

// Plan → max stores (0 = unlimited)
const PLAN_STORE_LIMITS: Record<string, number> = {
  STARTER:       1,
  GROWTH:        5,
  SCALE:         0,
  GRANDFATHERED: 0
};

// ─── HMAC helpers ─────────────────────────────────────────────────────────────

/**
 * Validates the HMAC signature Shopify attaches to install / OAuth query strings.
 * Removes the `hmac` key, sorts remaining params, and compares SHA-256 digests.
 */
function validateInstallHmac(query: Record<string, string>, secret: string): boolean {
  const { hmac, ...rest } = query;
  if (!hmac) return false;

  const message = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join("&");

  const expected = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("hex");

  try {
    return (
      hmac.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(hmac, "hex"), Buffer.from(expected, "hex"))
    );
  } catch {
    return false;
  }
}

/**
 * Validates the HMAC signature Shopify sends in webhook POST headers.
 * Uses base64 encoding (different from install flow).
 */
function validateWebhookHmac(rawBody: string, hmacHeader: string, secret: string): boolean {
  if (!hmacHeader) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");
  return hmacHeader === expected;
}

// ─── Cookie options (mirrors auth.ts) ─────────────────────────────────────────

const SESSION_COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/"
};

const FLAG_COOKIE = {
  httpOnly: false,
  sameSite: "lax" as const,
  path: "/"
};

// ─── Route registration ────────────────────────────────────────────────────────

export async function shopifyAppRoutes(app: FastifyInstance) {

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /shopify/install
  //
  // Entry point from the Shopify App Store (or the "Install" button in the
  // Shopify Partner Dashboard during dev).
  //
  // Query params (sent by Shopify):
  //   shop    — e.g. mystore.myshopify.com
  //   hmac    — HMAC-SHA256 signature (present on re-installs / app loads)
  //   timestamp, locale, ...
  //
  // Stores a short-lived nonce cookie and redirects to Shopify OAuth.
  // ═══════════════════════════════════════════════════════════════════════════
  app.get("/shopify/install", async (request, reply) => {
    const query = request.query as Record<string, string>;
    const rawShop = query.shop?.trim();

    if (!rawShop) {
      return reply.code(400).send({ ok: false, message: "Missing shop parameter" });
    }

    const apiKey    = app.config.SHOPIFY_API_KEY;
    const apiSecret = app.config.SHOPIFY_API_SECRET;

    if (!apiKey || !apiSecret) {
      return reply.code(503).send({ ok: false, message: "Shopify integration not configured" });
    }

    // Validate HMAC when Shopify sends one (app load / re-install)
    if (query.hmac && !validateInstallHmac(query, apiSecret)) {
      app.log.warn({ shop: rawShop }, "[shopify-app] Install HMAC invalid");
      return reply.code(400).send({ ok: false, message: "Invalid HMAC" });
    }

    // Normalise shop domain
    const shop = rawShop.replace(/https?:\/\//, "").replace(/\/$/, "");

    // Guard: must look like a myshopify.com domain
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop)) {
      return reply.code(400).send({ ok: false, message: "Invalid shop domain" });
    }

    // Generate a one-time nonce for state verification
    const nonce = crypto.randomBytes(16).toString("hex");

    reply.setCookie("shopify_nonce", nonce, {
      ...SESSION_COOKIE,
      maxAge: 300 // 5 min — enough time for the OAuth round-trip
    });

    const redirectUri = `${app.config.APP_URL}/shopify/callback`;

    const authUrl =
      `https://${shop}/admin/oauth/authorize` +
      `?client_id=${apiKey}` +
      `&scope=${SHOPIFY_SCOPES}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${nonce}`;

    app.log.info({ shop }, "[shopify-app] Redirecting to OAuth");
    return reply.redirect(authUrl);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /shopify/callback
  //
  // Shopify redirects here after the merchant grants permissions.
  //
  // What we do:
  //   1. Validate HMAC + nonce (state)
  //   2. Exchange code for permanent access token
  //   3. Fetch shop details (name, owner email, currency)
  //   4. Find or create the MetaFlow user (keyed by owner email)
  //   5. Find or create the Store record (keyed by shop domain)
  //   6. Upsert the SHOPIFY Connection
  //   7. Register webhooks
  //   8. Queue initial product sync + scoring
  //   9. Set session cookies + redirect to MetaFlow dashboard
  // ═══════════════════════════════════════════════════════════════════════════
  app.get("/shopify/callback", async (request, reply) => {
    const frontendBase = app.config.CORS_ORIGIN;
    const query = request.query as Record<string, string>;

    // --- 1a. HMAC validation ---
    if (!validateInstallHmac(query, app.config.SHOPIFY_API_SECRET)) {
      app.log.warn({ shop: query.shop }, "[shopify-app] Callback HMAC invalid");
      return reply.redirect(`${frontendBase}/auth/login?error=shopify_invalid_hmac`);
    }

    // --- 1b. Nonce (state) validation ---
    const savedNonce = (request.cookies as Record<string, string>)?.shopify_nonce;
    if (!savedNonce || savedNonce !== query.state) {
      app.log.warn({ shop: query.shop }, "[shopify-app] State/nonce mismatch");
      return reply.redirect(`${frontendBase}/auth/login?error=shopify_invalid_state`);
    }
    reply.clearCookie("shopify_nonce", { path: "/" });

    const shop = query.shop;
    const code = query.code;

    try {
      // --- 2. Exchange code for permanent access token ---
      const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          client_id:     app.config.SHOPIFY_API_KEY,
          client_secret: app.config.SHOPIFY_API_SECRET,
          code
        })
      });

      if (!tokenRes.ok) {
        app.log.error({ body: await tokenRes.text() }, "[shopify-app] Token exchange failed");
        return reply.redirect(`${frontendBase}/auth/login?error=shopify_token_failed`);
      }

      const tokenData = (await tokenRes.json()) as {
        access_token: string;
        scope: string;
      };
      const accessToken = tokenData.access_token;

      // --- 3. Fetch Shopify shop details ---
      const shopRes = await fetch(
        `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/shop.json`,
        { headers: { "X-Shopify-Access-Token": accessToken } }
      );
      const shopJson = (await shopRes.json()) as {
        shop: { name: string; email: string; currency: string; myshopify_domain: string };
      };
      const { name: shopName, email: rawEmail, currency } = shopJson.shop;
      const ownerEmail = rawEmail.trim().toLowerCase();

      // --- 4. Find or create MetaFlow user ---
      let user = await app.prisma.user.findUnique({ where: { email: ownerEmail } });

      let isNewUser = false;
      if (!user) {
        isNewUser = true;
        const randomPass   = crypto.randomBytes(32).toString("hex");
        const passwordHash = await bcrypt.hash(randomPass, 10);

        user = await app.prisma.user.create({
          data: {
            email:        ownerEmail,
            passwordHash,
            plan:         "STARTER",
            settings:     { create: {} }
          }
        });

        app.log.info({ email: ownerEmail }, "[shopify-app] Created new MetaFlow user");
        // TODO: queue welcome + "set your password" email to ownerEmail
      }

      // --- 5. Find or create Store ---
      let store = await app.prisma.store.findFirst({
        where: { ownerId: user.id, storeUrl: { contains: shop } }
      });

      if (!store) {
        // Enforce plan store limit
        const storeCount = await app.prisma.store.count({ where: { ownerId: user.id } });
        const limit       = PLAN_STORE_LIMITS[user.plan] ?? 1;

        if (limit > 0 && storeCount >= limit) {
          // Redirect to pricing — user needs to upgrade
          const upgradeToken = app.jwt.sign({ sub: user.id, email: user.email, role: user.role });
          const maxAge       = 60 * 60 * 24 * 7;
          reply.setCookie("mf_session", upgradeToken, { ...SESSION_COOKIE, secure: process.env.NODE_ENV === "production", maxAge });
          reply.setCookie("mf_auth",    "1",           { ...FLAG_COOKIE,    secure: process.env.NODE_ENV === "production", maxAge });
          reply.setCookie("mf_plan",    user.plan,     { ...FLAG_COOKIE,    secure: process.env.NODE_ENV === "production", maxAge });
          app.log.info({ userId: user.id, shop }, "[shopify-app] Store limit reached — redirecting to pricing");
          return reply.redirect(`${frontendBase}/pricing?reason=store_limit`);
        }

        store = await app.prisma.store.create({
          data: {
            name:     shopName,
            platform: "SHOPIFY",
            storeUrl: `https://${shop}`,
            currency,
            ownerId:  user.id
          }
        });

        app.log.info({ storeId: store.id, shop }, "[shopify-app] Created new store");
      }

      // --- 6. Upsert Shopify connection ---
      await app.prisma.connection.upsert({
        where:  { storeId_provider: { storeId: store.id, provider: "SHOPIFY" } },
        create: { provider: "SHOPIFY", accessToken, scopes: tokenData.scope, storeId: store.id },
        update: { accessToken, scopes: tokenData.scope }
      });

      // Keep store URL in sync
      await app.prisma.store.update({
        where: { id: store.id },
        data:  { storeUrl: `https://${shop}` }
      });

      // --- 7. Register webhooks (including app/uninstalled) ---
      await registerShopifyWebhooks(shop, accessToken, app.config.APP_URL);

      // Also register the uninstall webhook so we can clean up
      try {
        await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`, {
          method:  "POST",
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            webhook: {
              topic:   "app/uninstalled",
              address: `${app.config.APP_URL}/shopify/webhooks/uninstall`,
              format:  "json"
            }
          })
        });
      } catch {
        // Non-fatal — we'll pick it up from the Partner Dashboard if needed
      }

      // --- 8. Audit log + job queue ---
      await app.prisma.auditLog.create({
        data: {
          action:   isNewUser ? "Shopify App Installed (New User)" : "Shopify App Installed",
          detail:   `Shopify store ${shop} installed MetaFlow`,
          metadata: { provider: "SHOPIFY", shop, variant: "app_install", tag: "Info" },
          storeId:  store.id
        }
      });

      await app.queues.syncQueue.add(
        "shopify-sync",
        { storeId: store.id, provider: "SHOPIFY", shop, accessToken },
        { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
      );

      await app.queues.scoringQueue.add(
        "score-store",
        { storeId: store.id },
        { delay: 30_000, attempts: 2 }
      );

      // --- 9. Set session cookies + redirect ---
      const sessionToken = app.jwt.sign({ sub: user.id, email: user.email, role: user.role });
      const maxAge       = 60 * 60 * 24 * 7; // 7 days

      const isProduction = process.env.NODE_ENV === "production";

      reply.setCookie("mf_session", sessionToken, {
        ...SESSION_COOKIE,
        secure: isProduction,
        maxAge
      });
      reply.setCookie("mf_auth", "1", {
        ...FLAG_COOKIE,
        secure: isProduction,
        maxAge
      });
      reply.setCookie("mf_plan", user.plan, {
        ...FLAG_COOKIE,
        secure: isProduction,
        maxAge
      });
      if (user.role === "ADMIN") {
        reply.setCookie("mf_role", "ADMIN", {
          ...FLAG_COOKIE,
          secure: isProduction,
          maxAge
        });
      }

      // Send new users to onboarding, returning users to the dashboard
      const destination = isNewUser
        ? `${frontendBase}/app/onboarding?from=shopify`
        : `${frontendBase}/app/dashboard?from=shopify`;

      app.log.info({ userId: user.id, shop, isNewUser }, "[shopify-app] Install complete");
      return reply.redirect(destination);

    } catch (err) {
      app.log.error({ err }, "[shopify-app] Callback error");
      return reply.redirect(`${frontendBase}/auth/login?error=shopify_server_error`);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /shopify/webhooks/uninstall
  //
  // Shopify calls this when a merchant uninstalls the app.
  // We remove the SHOPIFY connection (data stays intact — user can reconnect).
  //
  // Shopify webhook verification uses base64 HMAC in X-Shopify-Hmac-SHA256.
  // ═══════════════════════════════════════════════════════════════════════════
  app.post(
    "/shopify/webhooks/uninstall",
    {
      // Disable the default body parser so we can read the raw bytes for HMAC
      config: { rawBody: true }
    },
    async (request, reply) => {
      const hmacHeader = (request.headers["x-shopify-hmac-sha256"] as string) ?? "";
      const shop       = (request.headers["x-shopify-shop-domain"] as string) ?? "";

      const rawBody =
        typeof (request as any).rawBody === "string"
          ? (request as any).rawBody
          : JSON.stringify(request.body ?? {});

      if (!validateWebhookHmac(rawBody, hmacHeader, app.config.SHOPIFY_API_SECRET)) {
        app.log.warn({ shop }, "[shopify-app] Uninstall webhook HMAC invalid");
        return reply.code(401).send({ ok: false });
      }

      try {
        const store = await app.prisma.store.findFirst({
          where:   { storeUrl: { contains: shop } },
          include: { connections: { where: { provider: "SHOPIFY" } } }
        });

        if (store?.connections[0]) {
          await app.prisma.connection.delete({ where: { id: store.connections[0].id } });

          await app.prisma.auditLog.create({
            data: {
              action:   "Shopify App Uninstalled",
              detail:   `Shopify store ${shop} uninstalled MetaFlow`,
              metadata: { provider: "SHOPIFY", shop, variant: "app_uninstall", tag: "Warning" },
              storeId:  store.id
            }
          });

          app.log.info({ shop, storeId: store.id }, "[shopify-app] Uninstall processed — connection removed");
        }

        // Always 200 for webhook acknowledgement
        return reply.code(200).send({ ok: true });
      } catch (err) {
        app.log.error({ err }, "[shopify-app] Uninstall webhook error");
        return reply.code(200).send({ ok: true });
      }
    }
  );
}
