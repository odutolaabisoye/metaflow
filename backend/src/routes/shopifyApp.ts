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
import { encryptToken } from "../utils/crypto.js";
import { convertCurrency } from "../utils/fx.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { registerShopifyWebhooks } from "./connections.js";
import { storeLocalDateStr, storeLocalDayBounds } from "../jobs/dateUtils.js";
import { fetchWithRetry } from "../utils/http.js";
import { SHOPIFY_API_VERSION } from "../utils/constants.js";

const SHOPIFY_SCOPES = "read_products,read_orders,read_inventory,write_products";

function generateJti() {
  return crypto.randomBytes(16).toString("hex");
}

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
 * Uses crypto.timingSafeEqual to prevent timing-based side-channel attacks —
 * a plain === comparison leaks timing info proportional to the shared prefix length.
 */
function validateWebhookHmac(rawBody: string, hmacHeader: string, secret: string): boolean {
  if (!hmacHeader) return false;
  try {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody, "utf8")
      .digest("base64");
    const a = Buffer.from(hmacHeader);
    const b = Buffer.from(expected);
    // Buffers must be the same length for timingSafeEqual; length mismatch is itself
    // non-secret (an attacker already knows the expected base64 length), so this is safe.
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
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
      const tokenRes = await fetchWithRetry(`https://${shop}/admin/oauth/access_token`, {
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
      const shopRes = await fetchWithRetry(
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
        // Send welcome + "set your password" email (fire-and-forget — don't block install)
        app.mail.sendWelcome(ownerEmail, shopName).catch((err: Error) =>
          app.log.warn({ err, email: ownerEmail }, "[shopify-app] Welcome email failed — install continues")
        );
      }

      // --- 5. Find or create Store ---
      // Use exact URL match — `contains` would match partial substrings and could
      // accidentally link to a different user's store (e.g. "store" matches "mystore").
      const canonicalShopUrl = `https://${shop}`;
      let store = await app.prisma.store.findFirst({
        where: { ownerId: user.id, storeUrl: canonicalShopUrl }
      });

      if (!store) {
        const limit = PLAN_STORE_LIMITS[user.plan] ?? 1;

        // Atomically check store count and create — SERIALIZABLE prevents concurrent installs
        // from both reading count=0 and then both creating a store, bypassing the plan limit.
        let limitExceeded = false;
        try {
          store = await app.prisma.$transaction(async (tx) => {
            const storeCount = await tx.store.count({ where: { ownerId: user.id } });
            if (limit > 0 && storeCount >= limit) {
              limitExceeded = true;
              return null;
            }
            return await tx.store.create({
              data: {
                name:     shopName,
                platform: "SHOPIFY",
                storeUrl: `https://${shop}`,
                currency,
                ownerId:  user.id
              }
            });
          }, { isolationLevel: "Serializable" });
        } catch (txErr) {
          // Serialization failure (concurrent install) — treat as limit exceeded to be safe
          app.log.warn({ userId: user.id, shop, err: txErr }, "[shopify-app] Store create transaction failed");
          limitExceeded = true;
        }

        if (limitExceeded || !store) {
          const upgradeToken = app.jwt.sign({ sub: user.id, email: user.email, role: user.role, jti: generateJti() });
          const maxAge       = 60 * 60 * 24 * 7;
          reply.setCookie("mf_session", upgradeToken, { ...SESSION_COOKIE, secure: process.env.NODE_ENV === "production", maxAge });
          reply.setCookie("mf_auth",    "1",           { ...FLAG_COOKIE,    secure: process.env.NODE_ENV === "production", maxAge });
          reply.setCookie("mf_plan",    user.plan,     { ...FLAG_COOKIE,    secure: process.env.NODE_ENV === "production", maxAge });
          app.log.info({ userId: user.id, shop }, "[shopify-app] Store limit reached — redirecting to pricing");
          return reply.redirect(`${frontendBase}/pricing?reason=store_limit`);
        }

        app.log.info({ storeId: store.id, shop }, "[shopify-app] Created new store");
      }

      const encryptedAccessToken = encryptToken(accessToken);

      // --- 6. Upsert Shopify connection ---
      await app.prisma.connection.upsert({
        where:  { storeId_provider: { storeId: store.id, provider: "SHOPIFY" } },
        create: { provider: "SHOPIFY", accessToken: encryptedAccessToken, scopes: tokenData.scope, storeId: store.id },
        update: { accessToken: encryptedAccessToken, scopes: tokenData.scope }
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
        await fetchWithRetry(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`, {
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
      const sessionToken = app.jwt.sign({ sub: user.id, email: user.email, role: user.role, jti: generateJti() });
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
      config: { rawBody: true, csrf: false }
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
          where:   { storeUrl: `https://${shop}` },
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

  // ═══════════════════════════════════════════════════════════════════════════
  // Webhook payload types (subset of full Shopify objects)
  // ═══════════════════════════════════════════════════════════════════════════

  interface WebhookProduct {
    id: number;
    title: string;
    handle: string;
    status: string; // "active" | "archived" | "draft"
    variants: Array<{
      id: number;
      sku: string;
      title?: string;
      inventory_quantity: number;
      price: string;
    }>;
    images: Array<{ src: string }>;
  }

  interface WebhookOrder {
    id: number;
    created_at: string;
    currency: string;        // store's base currency, e.g. "NGN"
    financial_status: string;
    line_items: Array<{
      product_id: number;
      variant_id: number;
      quantity: number;
      price: string;
    }>;
  }

  // ─── Shared helpers ────────────────────────────────────────────────────────

  /** Validates the webhook HMAC and extracts the shop domain. Returns null on failure. */
  function verifyWebhook(request: any, reply: any): { shop: string; rawBody: string } | null {
    const hmacHeader = (request.headers["x-shopify-hmac-sha256"] as string) ?? "";
    const shop       = (request.headers["x-shopify-shop-domain"]  as string) ?? "";
    const rawBody    = typeof (request as any).rawBody === "string"
      ? (request as any).rawBody
      : JSON.stringify(request.body ?? {});

    if (!validateWebhookHmac(rawBody, hmacHeader, app.config.SHOPIFY_API_SECRET)) {
      app.log.warn({ shop }, "[shopify-webhook] HMAC invalid");
      reply.code(401).send({ ok: false });
      return null;
    }
    return { shop, rawBody };
  }

  /** Looks up the MetaFlow Store record by shop domain. */
  async function findStoreByShop(shop: string) {
    return app.prisma.store.findFirst({
      where: { storeUrl: `https://${shop}` },
      select: { id: true, currency: true, timezone: true }
    });
  }

  /** Builds a variant title, collapsing "Default Title" → parent title. */
  function buildVariantTitle(productTitle: string, variantTitle?: string): string {
    if (!variantTitle || variantTitle.toLowerCase() === "default title") return productTitle;
    return `${productTitle} — ${variantTitle}`;
  }

  /** Upserts ProductMeta for a product and all its variants from a webhook payload. */
  async function upsertProductFromWebhook(storeId: string, shop: string, product: WebhookProduct): Promise<void> {
    const firstVariant = product.variants[0];
    if (!firstVariant) return;

    const parentExternalId = String(product.id);
    const parentSku   = firstVariant.sku || `SHOPIFY-${firstVariant.id}`;
    const imageUrl    = product.images[0]?.src ?? null;
    const productUrl  = product.handle ? `https://${shop}/products/${product.handle}` : null;
    const altIds      = product.variants.map((v) => String(v.id));
    const inventoryLevel = product.variants.reduce((sum, v) => sum + (v.inventory_quantity ?? 0), 0);

    const parent = await app.prisma.productMeta.upsert({
      where:  { storeId_externalId: { storeId, externalId: parentExternalId } },
      create: {
        externalId: parentExternalId, sku: parentSku, altIds, title: product.title,
        imageUrl, productUrl, score: 0, category: "TEST", storeId,
        isActive: true, archivedAt: null, isVariant: false, parentId: null
      },
      update: {
        title: product.title, imageUrl, sku: parentSku, altIds, productUrl,
        inventoryLevel, isActive: true, archivedAt: null
      }
    });

    for (const variant of product.variants) {
      const variantExternalId = String(variant.id);
      const variantSku   = variant.sku || `SHOPIFY-${variant.id}`;
      const variantTitle = buildVariantTitle(product.title, variant.title);
      const variantUrl   = productUrl ? `${productUrl}?variant=${variant.id}` : null;

      await app.prisma.productMeta.upsert({
        where:  { storeId_externalId: { storeId, externalId: variantExternalId } },
        create: {
          externalId: variantExternalId, sku: variantSku, title: variantTitle,
          imageUrl, productUrl: variantUrl, score: 0, category: "TEST", storeId,
          isActive: true, archivedAt: null, isVariant: true, parentId: parent.id
        },
        update: {
          title: variantTitle, imageUrl, sku: variantSku, productUrl: variantUrl,
          inventoryLevel: variant.inventory_quantity ?? null,
          isActive: true, archivedAt: null, isVariant: true, parentId: parent.id
        }
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /webhooks/shopify/products/create
  // POST /webhooks/shopify/products/update
  //
  // Shopify fires these when a product is created or its metadata changes
  // (title, SKU, variant inventory, images, etc.).  We upsert ProductMeta
  // immediately so the dashboard reflects changes before the nightly sync.
  // ═══════════════════════════════════════════════════════════════════════════
  for (const path of [
    "/webhooks/shopify/products/create",
    "/webhooks/shopify/products/update"
  ] as const) {
    app.post(path, { config: { rawBody: true, csrf: false } }, async (request, reply) => {
      const ctx = verifyWebhook(request, reply);
      if (!ctx) return;

      try {
        const product = request.body as WebhookProduct;
        const store = await findStoreByShop(ctx.shop);
        if (!store) {
          app.log.warn({ shop: ctx.shop }, "[shopify-webhook] products — store not found");
          return reply.code(200).send({ ok: true });
        }

        // Archived/draft products → soft-delete and skip variant upserts
        if (product.status === "archived" || product.status === "draft") {
          await app.prisma.productMeta.updateMany({
            where: { storeId: store.id, externalId: String(product.id), isActive: true },
            data:  { isActive: false, archivedAt: new Date() }
          });
          app.log.info({ shop: ctx.shop, productId: product.id, status: product.status },
            "[shopify-webhook] product soft-deleted (non-active status)");
          return reply.code(200).send({ ok: true });
        }

        await upsertProductFromWebhook(store.id, ctx.shop, product);
        app.log.info({ shop: ctx.shop, productId: product.id },
          `[shopify-webhook] product upserted (${path.split("/").pop()})`);

        return reply.code(200).send({ ok: true });
      } catch (err) {
        app.log.error({ err }, `[shopify-webhook] ${path} error`);
        return reply.code(200).send({ ok: true });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /webhooks/shopify/products/delete
  //
  // Shopify fires this when a product is permanently deleted.
  // We soft-delete the parent ProductMeta + all its variants.
  // ═══════════════════════════════════════════════════════════════════════════
  app.post(
    "/webhooks/shopify/products/delete",
    { config: { rawBody: true, csrf: false } },
    async (request, reply) => {
      const ctx = verifyWebhook(request, reply);
      if (!ctx) return;

      try {
        const { id: productId } = request.body as { id: number };
        const store = await findStoreByShop(ctx.shop);
        if (!store) return reply.code(200).send({ ok: true });

        const externalId = String(productId);

        // Find the parent row to get its DB id (for variant parentId lookup)
        const parent = await app.prisma.productMeta.findUnique({
          where:  { storeId_externalId: { storeId: store.id, externalId } },
          select: { id: true }
        });

        // Soft-delete parent + variants (variants have parentId = parent.id)
        const deleteWhere = parent
          ? { storeId: store.id, isActive: true, OR: [{ externalId }, { parentId: parent.id }] }
          : { storeId: store.id, isActive: true, externalId };

        const { count } = await app.prisma.productMeta.updateMany({
          where: deleteWhere,
          data:  { isActive: false, archivedAt: new Date() }
        });

        app.log.info({ shop: ctx.shop, productId, affected: count },
          "[shopify-webhook] product deleted");
        return reply.code(200).send({ ok: true });
      } catch (err) {
        app.log.error({ err }, "[shopify-webhook] products/delete error");
        return reply.code(200).send({ ok: true });
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /webhooks/shopify/orders/create
  //
  // Shopify fires this as soon as an order is placed.
  // We update today's DailyMetric revenue immediately — so the dashboard
  // reflects today's sales within seconds, not at the nightly 2am sync.
  //
  // Multi-currency: if the order currency differs from the store currency
  // (possible on multi-currency Shopify stores), we convert via FX API.
  // ═══════════════════════════════════════════════════════════════════════════
  app.post(
    "/webhooks/shopify/orders/create",
    { config: { rawBody: true, csrf: false } },
    async (request, reply) => {
      const ctx = verifyWebhook(request, reply);
      if (!ctx) return;

      try {
        const order = request.body as WebhookOrder;

        // Only process paid orders
        if (order.financial_status !== "paid") {
          return reply.code(200).send({ ok: true });
        }

        // ── Idempotency guard ────────────────────────────────────────────────
        // Shopify retries webhooks on non-2xx or timeouts. Without this guard
        // each retry would increment revenue a second time.
        // NX = only set if key does NOT exist; EX = auto-expire after 72h.
        // 72h (vs 24h) covers Shopify's 48h retry window with headroom.
        if (app.redis) {
          const idempotencyKey = `webhook:order:${order.id}`;
          const wasSet = await app.redis.set(idempotencyKey, "1", "EX", 259200, "NX");
          if (!wasSet) {
            app.log.info(
              { shop: ctx.shop, orderId: order.id },
              "[shopify-webhook] duplicate orders/create — skipping"
            );
            return reply.code(200).send({ ok: true });
          }
        }
        // ─────────────────────────────────────────────────────────────────────

        const store = await findStoreByShop(ctx.shop);
        if (!store) return reply.code(200).send({ ok: true });

        const { id: storeId, timezone = "UTC", currency: storeCurrency } = store;

        // Determine the local date for this order
        const orderDate     = new Date(order.created_at);
        const orderLocalStr = storeLocalDateStr(timezone, orderDate);
        const { start: orderDay } = storeLocalDayBounds(timezone, orderDate);

        // FX multiplier if order currency ≠ store currency
        let fxRate = 1;
        if (order.currency && storeCurrency && order.currency !== storeCurrency) {
          fxRate = await convertCurrency(1, order.currency, storeCurrency);
          app.log.info(
            { shop: ctx.shop, orderCurrency: order.currency, storeCurrency, fxRate },
            "[shopify-webhook] currency conversion applied"
          );
        }

        // Build a map: variantId → { revenue, orderCount } for this single order
        const lineMap = new Map<number, { revenue: number; orders: number }>();
        for (const item of order.line_items) {
          const itemId  = item.variant_id && item.variant_id > 0 ? item.variant_id : item.product_id;
          const revenue = parseFloat(item.price) * item.quantity * fxRate;
          const existing = lineMap.get(itemId) ?? { revenue: 0, orders: 0 };
          lineMap.set(itemId, { revenue: existing.revenue + revenue, orders: existing.orders + 1 });
        }

        const todayLocalStr = storeLocalDateStr(timezone);

        // Wrap all per-line-item DB writes in a single transaction so that a
        // partial failure (e.g. mid-loop crash) cannot leave revenue half-credited.
        await app.prisma.$transaction(async (tx) => {
          for (const [itemId, { revenue, orders }] of lineMap) {
            // Look up the ProductMeta by externalId (variant id → string)
            const productMeta = await tx.productMeta.findUnique({
              where:  { storeId_externalId: { storeId, externalId: String(itemId) } },
              select: { id: true }
            });
            if (!productMeta) continue;

            const existingMetric = await tx.dailyMetric.findUnique({
              where:  { storeId_productId_date: { storeId, productId: productMeta.id, date: orderDay } },
              select: { revenue: true, conversions: true, roas: true, ctr: true, spend: true,
                        blendedRoas: true, conversionRate: true, margin: true, velocity: true,
                        metaRevenue: true, impressions: true, clicks: true, inventoryLevel: true }
            });

            if (orderLocalStr === todayLocalStr) {
              // Today: increment revenue and conversions on today's row
              if (existingMetric) {
                await tx.dailyMetric.update({
                  where: { storeId_productId_date: { storeId, productId: productMeta.id, date: orderDay } },
                  data:  {
                    revenue:     { increment: revenue },
                    conversions: { increment: orders }
                  }
                });
              } else {
                await tx.dailyMetric.create({
                  data: {
                    date: orderDay, storeId, productId: productMeta.id,
                    roas: 0, blendedRoas: null, ctr: 0, conversionRate: 0,
                    margin: 0.35, velocity: 0, spend: 0,
                    revenue, metaRevenue: null, impressions: null, clicks: null,
                    conversions: orders, inventoryLevel: null
                  }
                });
              }
            } else {
              // Historical date (order with a backdated created_at, rare but possible)
              await tx.dailyMetric.upsert({
                where:  { storeId_productId_date: { storeId, productId: productMeta.id, date: orderDay } },
                create: {
                  date: orderDay, storeId, productId: productMeta.id,
                  roas: 0, blendedRoas: null, ctr: 0, conversionRate: 0,
                  margin: 0.35, velocity: 0, spend: 0,
                  revenue, metaRevenue: null, impressions: null, clicks: null,
                  conversions: orders, inventoryLevel: null
                },
                update: {
                  revenue:     { increment: revenue },
                  conversions: { increment: orders }
                }
              });
            }
          }
        });

        app.log.info(
          { shop: ctx.shop, orderId: order.id, lineItems: lineMap.size },
          "[shopify-webhook] order/create revenue updated"
        );
        return reply.code(200).send({ ok: true });
      } catch (err) {
        app.log.error({ err }, "[shopify-webhook] orders/create error");
        return reply.code(200).send({ ok: true });
      }
    }
  );
}
