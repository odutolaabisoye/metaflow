/**
 * WooCommerce Webhook Handlers
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles incoming webhook POSTs from WooCommerce stores.
 *
 * Routes (no /v1 prefix — registered directly at root, matching the delivery
 * URLs registered via the WooCommerce REST API on store connect):
 *   POST /webhooks/woocommerce/products/created
 *   POST /webhooks/woocommerce/products/updated
 *   POST /webhooks/woocommerce/products/deleted
 *   POST /webhooks/woocommerce/orders/created
 *
 * Security:
 *   - HMAC-SHA256 via X-WC-Webhook-Signature (base64)
 *   - Per-store secret stored encrypted in Connection.webhookSecret
 *   - Idempotency via X-WC-Webhook-Delivery-ID (Redis NX, 24h TTL)
 *
 * Shop identification:
 *   WooCommerce sends X-WC-Webhook-Source (the store URL). We look up the
 *   Connection record by storeUrl prefix to find the store.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// FastifyInstance is referenced in JSDoc only — actual params use `any` to match
// the project-wide pattern (Fastify 5 generics require explicit type params otherwise).
import crypto from "crypto";
import { decryptToken } from "../utils/crypto.js";
import { convertCurrency } from "../utils/fx.js";
import { storeLocalDateStr, storeLocalDayBounds } from "../jobs/dateUtils.js";

// ─── WooCommerce payload types ────────────────────────────────────────────────

interface WCWebhookProduct {
  id:          number;
  name:        string;
  sku:         string;
  status:      string;  // "publish" | "draft" | "trash" | "private"
  description: string;
  short_description: string;
  images: Array<{ src: string }>;
  price:         string;
  regular_price: string;
  stock_quantity: number | null;
  manage_stock:   boolean;
  permalink:      string;
  variations:     number[];   // child variation IDs (simple products: empty)
}

interface WCWebhookOrder {
  id:               number;
  status:           string;  // "completed" | "processing" | "pending" | ...
  currency:         string;
  total:            string;
  line_items: Array<{
    product_id:   number;
    variation_id: number;
    quantity:     number;
    total:        string;   // line total (price × qty, pre-discount)
  }>;
  date_created: string;
}

// ─── HMAC verification ────────────────────────────────────────────────────────

/**
 * Verifies the X-WC-Webhook-Signature header.
 * WooCommerce signs the raw request body with HMAC-SHA256 and base64-encodes it.
 */
function verifyWooSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  if (!signatureHeader || !secret) return false;
  try {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody, "utf8")
      .digest("base64");
    // Use timingSafeEqual to prevent timing attacks
    const a = Buffer.from(signatureHeader);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ─── Store lookup ─────────────────────────────────────────────────────────────

interface WooStore {
  id:            string;
  timezone:      string;
  currency:      string;
  webhookSecret: string;  // decrypted plain-text secret
}

async function findWooStoreBySource(
  source: string,
  app: any
): Promise<WooStore | null> {
  if (!source) return null;

  // Normalise to a bare origin with no trailing slash so we can do an exact match.
  // WooCommerce sends X-WC-Webhook-Source as the store's home URL, e.g.:
  //   "https://myshop.com/"  →  "https://myshop.com"
  //   "https://shop.example.com/store/"  →  "https://shop.example.com/store"
  // We store storeUrl without a trailing slash (enforced on connect), so the
  // two values should be byte-identical after this normalisation.
  // Using `equals` (exact match) instead of `contains` prevents a store at
  // "https://shop.example.com" from accidentally matching
  // "https://shop.example.com.evil.net" or a longer sub-path.
  let normalised: string;
  try {
    const url = new URL(source);
    // Keep origin + pathname but drop trailing slash
    normalised = (url.origin + url.pathname).replace(/\/$/, "");
  } catch {
    // source wasn't a valid URL — bail out
    app.log.warn({ source }, "[woo-webhook] Invalid X-WC-Webhook-Source URL");
    return null;
  }

  const store = await app.prisma.store.findFirst({
    where: {
      platform: "WOOCOMMERCE",
      storeUrl:  normalised,   // exact match — no ambiguity with shared-prefix domains
    },
    select: {
      id:         true,
      timezone:   true,
      currency:   true,
      connections: {
        where:  { provider: "WOOCOMMERCE" },
        select: { webhookSecret: true }
      }
    }
  });

  if (!store) return null;

  const encryptedSecret = store.connections[0]?.webhookSecret;
  if (!encryptedSecret) return null;

  let webhookSecret: string;
  try {
    webhookSecret = decryptToken(encryptedSecret);
  } catch {
    return null;
  }

  return {
    id:            store.id,
    timezone:      store.timezone ?? "UTC",
    currency:      store.currency ?? "USD",
    webhookSecret,
  };
}

// ─── Shared webhook context validation ───────────────────────────────────────

interface WooWebhookCtx {
  store:       WooStore;
  deliveryId:  string;
}

/**
 * Verifies HMAC, applies idempotency guard, returns store context.
 * Returns null and sends a 200 reply if validation fails or is a duplicate.
 * (Always ack 200 to prevent WooCommerce from disabling the webhook.)
 */
async function verifyWooWebhook(
  request: any,
  reply:   any,
  app:     any,
  topic:   string
): Promise<WooWebhookCtx | null> {
  const headers    = request.headers as Record<string, string>;
  const source     = headers["x-wc-webhook-source"]   ?? "";
  const signature  = headers["x-wc-webhook-signature"] ?? "";
  const deliveryId = headers["x-wc-webhook-delivery-id"] ?? "";
  const rawBody    = (request as any).rawBody as string ?? JSON.stringify(request.body);

  // 1. Look up the store + decrypt secret
  const store = await findWooStoreBySource(source, app);
  if (!store) {
    app.log.warn({ source, topic }, "[woo-webhook] No matching store found");
    return null; // ack silently — might be a misconfigured / deleted store
  }

  // 2. Verify HMAC
  if (!verifyWooSignature(rawBody, signature, store.webhookSecret)) {
    app.log.warn({ source, topic, deliveryId }, "[woo-webhook] HMAC verification failed");
    reply.code(401).send({ ok: false, message: "Invalid signature" });
    return null;
  }

  // 3. Idempotency guard — skip if we've already processed this delivery.
  // If Redis is unavailable we reject the webhook with 503 rather than silently
  // processing it without deduplication. WooCommerce will retry on 5xx, so no
  // deliveries are lost. This prevents duplicate orders / inflated revenue when
  // Redis has a brief outage and the same webhook fires multiple times.
  if (deliveryId) {
    if (!app.redis) {
      app.log.warn({ source, topic, deliveryId }, "[woo-webhook] Redis unavailable — rejecting webhook to preserve idempotency");
      reply.code(503).send({ ok: false, message: "Service temporarily unavailable — please retry" });
      return null;
    }
    const idempotencyKey = `webhook:woo:${deliveryId}`;
    const wasSet = await app.redis.set(idempotencyKey, "1", "EX", 86400, "NX");
    if (!wasSet) {
      app.log.info({ source, topic, deliveryId }, "[woo-webhook] Duplicate delivery — skipping");
      reply.code(200).send({ ok: true });
      return null;
    }
  }

  return { store, deliveryId };
}

// ─── Route registration ────────────────────────────────────────────────────────

export async function wooWebhookRoutes(app: any) {

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /webhooks/woocommerce/products/created
  // POST /webhooks/woocommerce/products/updated
  //
  // Upserts ProductMeta for the product and all its variation children.
  // Soft-deletes if status is "trash".
  // ═══════════════════════════════════════════════════════════════════════════

  for (const path of [
    "/webhooks/woocommerce/products/created",
    "/webhooks/woocommerce/products/updated",
  ]) {
    app.post(path, { config: { rawBody: true, csrf: false } }, async (request, reply) => {
      const topic = path.includes("created") ? "product.created" : "product.updated";

      const ctx = await verifyWooWebhook(request, reply, app, topic);
      if (!ctx) return reply.sent ? undefined : reply.code(200).send({ ok: true });

      try {
        const product = request.body as WCWebhookProduct;
        const { store } = ctx;

        const isDeleted = product.status === "trash";
        const now       = new Date();

        // Upsert parent product
        await app.prisma.productMeta.upsert({
          where:  { storeId_externalId: { storeId: store.id, externalId: String(product.id) } },
          create: {
            storeId:     store.id,
            externalId:  String(product.id),
            title:       product.name,
            sku:         product.sku || null,
            imageUrl:    product.images?.[0]?.src ?? null,
            productUrl:  product.permalink ?? null,
            isActive:    !isDeleted,
            archivedAt:  isDeleted ? now : null,
          },
          update: {
            title:      product.name,
            sku:        product.sku || null,
            imageUrl:   product.images?.[0]?.src ?? null,
            productUrl: product.permalink ?? null,
            isActive:   !isDeleted,
            archivedAt: isDeleted ? now : null,
          }
        });

        // Soft-delete variations if parent is trashed
        if (isDeleted && product.variations?.length) {
          await app.prisma.productMeta.updateMany({
            where: {
              storeId:    store.id,
              externalId: { in: product.variations.map(String) }
            },
            data: { isActive: false, archivedAt: now }
          });
        }

        app.log.info(
          { storeId: store.id, productId: product.id, topic, isDeleted },
          "[woo-webhook] product upserted"
        );
        return reply.code(200).send({ ok: true });
      } catch (err) {
        app.log.error({ err }, `[woo-webhook] ${topic} error`);
        return reply.code(200).send({ ok: true });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /webhooks/woocommerce/products/deleted
  //
  // Soft-deletes the product and all its variations.
  // ═══════════════════════════════════════════════════════════════════════════
  app.post(
    "/webhooks/woocommerce/products/deleted",
    { config: { rawBody: true, csrf: false } },
    async (request, reply) => {
      const ctx = await verifyWooWebhook(request, reply, app, "product.deleted");
      if (!ctx) return reply.sent ? undefined : reply.code(200).send({ ok: true });

      try {
        const product = request.body as Pick<WCWebhookProduct, "id" | "variations">;
        const { store } = ctx;
        const now = new Date();

        const externalIds = [
          String(product.id),
          ...(product.variations ?? []).map(String),
        ];

        const { count } = await app.prisma.productMeta.updateMany({
          where: { storeId: store.id, externalId: { in: externalIds } },
          data:  { isActive: false, archivedAt: now }
        });

        app.log.info(
          { storeId: store.id, productId: product.id, affected: count },
          "[woo-webhook] product deleted (soft)"
        );
        return reply.code(200).send({ ok: true });
      } catch (err) {
        app.log.error({ err }, "[woo-webhook] product.deleted error");
        return reply.code(200).send({ ok: true });
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /webhooks/woocommerce/orders/created
  //
  // Updates DailyMetric revenue in real-time (same pattern as Shopify).
  // Only processes orders with status "completed" or "processing".
  // ═══════════════════════════════════════════════════════════════════════════
  app.post(
    "/webhooks/woocommerce/orders/created",
    { config: { rawBody: true, csrf: false } },
    async (request, reply) => {
      const ctx = await verifyWooWebhook(request, reply, app, "order.created");
      if (!ctx) return reply.sent ? undefined : reply.code(200).send({ ok: true });

      try {
        const order = request.body as WCWebhookOrder;
        const { store } = ctx;

        // Only process paid orders
        if (!["completed", "processing"].includes(order.status)) {
          return reply.code(200).send({ ok: true });
        }

        const { id: storeId, timezone, currency: storeCurrency } = store;

        // FX conversion if order currency differs from store currency
        let fxRate = 1;
        if (order.currency && storeCurrency && order.currency !== storeCurrency) {
          fxRate = await convertCurrency(1, order.currency, storeCurrency);
          app.log.info(
            { storeId, orderCurrency: order.currency, storeCurrency, fxRate },
            "[woo-webhook] currency conversion applied"
          );
        }

        const orderDate     = new Date(order.date_created);
        const orderLocalStr = storeLocalDateStr(timezone, orderDate);
        const todayLocalStr = storeLocalDateStr(timezone);
        const { start: orderDay } = storeLocalDayBounds(timezone, orderDate);

        // Build lineItem map: productId → { revenue, orders }
        const lineMap = new Map<number, { revenue: number; orders: number }>();
        for (const item of order.line_items) {
          // Prefer variation_id (if set and non-zero), otherwise fall back to product_id
          const itemId  = item.variation_id && item.variation_id > 0 ? item.variation_id : item.product_id;
          const revenue = parseFloat(item.total) * fxRate;
          const prev    = lineMap.get(itemId) ?? { revenue: 0, orders: 0 };
          lineMap.set(itemId, { revenue: prev.revenue + revenue, orders: prev.orders + 1 });
        }

        for (const [itemId, { revenue, orders }] of lineMap) {
          const productMeta = await app.prisma.productMeta.findUnique({
            where:  { storeId_externalId: { storeId, externalId: String(itemId) } },
            select: { id: true }
          });
          if (!productMeta) continue;

          if (orderLocalStr === todayLocalStr) {
            const existing = await app.prisma.dailyMetric.findUnique({
              where:  { storeId_productId_date: { storeId, productId: productMeta.id, date: orderDay } },
              select: { id: true }
            });
            if (existing) {
              await app.prisma.dailyMetric.update({
                where: { storeId_productId_date: { storeId, productId: productMeta.id, date: orderDay } },
                data:  { revenue: { increment: revenue }, conversions: { increment: orders } }
              });
            } else {
              await app.prisma.dailyMetric.create({
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
            await app.prisma.dailyMetric.upsert({
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

        app.log.info(
          { storeId, orderId: order.id, lineItems: lineMap.size },
          "[woo-webhook] order/created revenue updated"
        );
        return reply.code(200).send({ ok: true });
      } catch (err) {
        app.log.error({ err }, "[woo-webhook] order.created error");
        return reply.code(200).send({ ok: true });
      }
    }
  );
}
