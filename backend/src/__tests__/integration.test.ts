/**
 * MetaFlow Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Route-level tests using Fastify's app.inject() — no live server, no real DB.
 * Dependencies (Prisma, Redis, mail) are replaced with lightweight in-memory
 * stubs so tests are fast, deterministic, and require zero infrastructure.
 *
 * Coverage:
 *   • Auth routes   — signup, login, logout, /auth/me
 *   • Shopify webhooks — HMAC verification, idempotency, revenue increment
 *   • WooCommerce webhooks — HMAC verification, idempotency, product upsert
 *
 * Run with: npx tsx --test src/__tests__/integration.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";

// Must be set before importing crypto utility
process.env.ENCRYPTION_KEY = "a".repeat(64);

import { encryptToken } from "../utils/crypto.js";
import { authRoutes } from "../routes/auth.js";
import { shopifyAppRoutes } from "../routes/shopifyApp.js";
import { wooWebhookRoutes } from "../routes/wooWebhooks.js";

// ─── In-memory Prisma stub ────────────────────────────────────────────────────

type MockUser = {
  id: string; email: string; passwordHash: string; name: string | null;
  role: string; plan: string; createdAt: Date;
};

type MockProductMeta = {
  id: string; storeId: string; externalId: string;
  title: string; isActive: boolean; archivedAt: Date | null;
  sku: string | null; imageUrl: string | null; productUrl: string | null;
};

type MockDailyMetric = {
  id: string; storeId: string; productId: string; date: Date;
  revenue: number; conversions: number; roas: number; ctr: number;
  spend: number; margin: number; velocity: number;
  blendedRoas: null; conversionRate: number; metaRevenue: null;
  impressions: null; clicks: null; inventoryLevel: null;
};

function makePrismaStub() {
  const users       = new Map<string, MockUser>();
  const productMeta = new Map<string, MockProductMeta>();  // key: storeId_externalId
  const metrics     = new Map<string, MockDailyMetric>();   // key: storeId_productId_date

  return {
    _users:       users,
    _productMeta: productMeta,
    _metrics:     metrics,

    user: {
      findUnique: async ({ where }: any) => {
        if (where.email) return [...users.values()].find(u => u.email === where.email) ?? null;
        if (where.id)    return users.get(where.id) ?? null;
        return null;
      },
      create: async ({ data }: any) => {
        const user: MockUser = {
          id: `user_${users.size + 1}`, email: data.email,
          passwordHash: data.passwordHash, name: data.name ?? null,
          role: data.role ?? "USER", plan: data.plan ?? "STARTER",
          createdAt: new Date()
        };
        users.set(user.id, user);
        return user;
      }
    },

    store: {
      findFirst: async ({ where }: any) => {
        if (where?.platform === "WOOCOMMERCE") {
          return {
            id: "store_woo_1", timezone: "UTC", currency: "USD",
            connections: [{
              webhookSecret: encryptToken("test-woo-secret-32charslongXYZABC")
            }]
          };
        }
        // Shopify store lookup — handles both { contains: "..." } and exact string forms
        const storeUrlFilter = where?.storeUrl;
        const shopFragment =
          typeof storeUrlFilter === "string"
            ? storeUrlFilter
            : storeUrlFilter?.contains ?? "";
        if (shopFragment.includes("testshop")) {
          return { id: "store_1", timezone: "UTC", currency: "USD" };
        }
        return null;
      }
    },

    productMeta: {
      findUnique: async ({ where }: any) => {
        const key = `${where.storeId_externalId?.storeId}_${where.storeId_externalId?.externalId}`;
        return productMeta.get(key) ?? null;
      },
      upsert: async ({ where, create, update }: any) => {
        const key = `${where.storeId_externalId?.storeId}_${where.storeId_externalId?.externalId}`;
        const existing = productMeta.get(key);
        if (existing) {
          const updated = { ...existing, ...update };
          productMeta.set(key, updated);
          return updated;
        }
        const created: MockProductMeta = { id: `pm_${productMeta.size + 1}`, ...create };
        productMeta.set(key, created);
        return created;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const [key, pm] of productMeta) {
          if (pm.storeId === where.storeId) {
            if (!where.externalId || where.externalId.in?.includes(pm.externalId)) {
              productMeta.set(key, { ...pm, ...data });
              count++;
            }
          }
        }
        return { count };
      }
    },

    dailyMetric: {
      findUnique: async ({ where }: any) => {
        const k = where.storeId_productId_date;
        const key = `${k.storeId}_${k.productId}_${k.date.toISOString()}`;
        return metrics.get(key) ?? null;
      },
      create: async ({ data }: any) => {
        const key = `${data.storeId}_${data.productId}_${data.date.toISOString()}`;
        const row: MockDailyMetric = { id: `dm_${metrics.size + 1}`, ...data };
        metrics.set(key, row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const k = where.storeId_productId_date;
        const key = `${k.storeId}_${k.productId}_${k.date.toISOString()}`;
        const row = metrics.get(key);
        if (!row) throw new Error("Row not found");
        const updated = {
          ...row,
          revenue:     data.revenue?.increment !== undefined
                         ? row.revenue + data.revenue.increment
                         : (data.revenue ?? row.revenue),
          conversions: data.conversions?.increment !== undefined
                         ? row.conversions + data.conversions.increment
                         : (data.conversions ?? row.conversions),
        };
        metrics.set(key, updated);
        return updated;
      },
      upsert: async ({ where, create, update }: any) => {
        const k = where.storeId_productId_date;
        const key = `${k.storeId}_${k.productId}_${k.date.toISOString()}`;
        const existing = metrics.get(key);
        if (existing) {
          const updated = {
            ...existing,
            revenue:     update.revenue?.increment !== undefined
                           ? existing.revenue + update.revenue.increment
                           : (update.revenue ?? existing.revenue),
            conversions: update.conversions?.increment !== undefined
                           ? existing.conversions + update.conversions.increment
                           : (update.conversions ?? existing.conversions),
          };
          metrics.set(key, updated);
          return updated;
        }
        const created: MockDailyMetric = { id: `dm_${metrics.size + 1}`, ...create };
        metrics.set(key, created);
        return created;
      }
    },

    auditLog: {
      create: async () => ({ id: "audit_1" })
    }
  };
}

// ─── In-memory Redis stub ─────────────────────────────────────────────────────

function makeRedisStub() {
  const store = new Map<string, { value: string; expiresAt: number }>();
  return {
    _store: store,
    set: async (key: string, value: string, ...args: any[]) => {
      // args: ["EX", ttlSeconds, "NX"]  OR  ["EX", ttlSeconds]
      const exIdx  = args.indexOf("EX");
      const ttlSec = exIdx !== -1 ? args[exIdx + 1] : 3600;
      const isNX   = args.includes("NX");
      if (isNX && store.has(key)) {
        const entry = store.get(key)!;
        if (entry.expiresAt > Date.now()) return null;  // key still alive → NX fails
      }
      store.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
      return "OK";
    },
    get: async (key: string) => {
      const entry = store.get(key);
      if (!entry || entry.expiresAt <= Date.now()) return null;
      return entry.value;
    }
  };
}

// ─── Fastify app builder ──────────────────────────────────────────────────────

async function buildApp(routes: "auth" | "shopify" | "woo") {
  const app = Fastify({ logger: false });

  const prismaStub = makePrismaStub();
  const redisStub  = makeRedisStub();

  // Decorate with stubs
  app.decorate("prisma", prismaStub);
  app.decorate("redis",  redisStub);
  app.decorate("mail",   { sendWelcome: async () => {}, sendPasswordReset: async () => {} });
  app.decorate("config", {
    JWT_SECRET:              "test-jwt-secret-at-least-32chars!!",
    SHOPIFY_API_SECRET:      "test-shopify-secret",
    SHOPIFY_WEBHOOK_SECRET:  "test-shopify-webhook-secret",
    SHOPIFY_API_KEY:         "test-api-key",
    CORS_ORIGIN:             "http://localhost:3000",
  });

  await app.register(cookie);
  await app.register(jwt, {
    secret: "test-jwt-secret-at-least-32chars!!",
    cookie: { cookieName: "mf_session", signed: false },
    sign:   { expiresIn: "7d" }
  });
  await app.register(rateLimit, { max: 1000, timeWindow: "1 minute" });

  if (routes === "auth")    await app.register(authRoutes,       { prefix: "/v1" });
  if (routes === "shopify") await app.register(shopifyAppRoutes);
  if (routes === "woo")     await app.register(wooWebhookRoutes);

  await app.ready();
  return app;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH ROUTES
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /v1/auth/signup", () => {
  test("Returns 200 + user on valid signup", async () => {
    const app = await buildApp("auth");
    const res = await app.inject({
      method:  "POST",
      url:     "/v1/auth/signup",
      payload: { email: "alice@example.com", password: "securepass123" }
    });
    const body = JSON.parse(res.payload);
    assert.equal(res.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.user.email, "alice@example.com");
    assert.equal(body.user.role, "USER");
    // Should set session cookie
    const cookies = res.headers["set-cookie"] as string | string[];
    const cookieStr = Array.isArray(cookies) ? cookies.join("; ") : cookies;
    assert.ok(cookieStr?.includes("mf_session="), "Should set mf_session cookie");
    await app.close();
  });

  test("Returns 409 for duplicate email", async () => {
    const app = await buildApp("auth");
    // First signup
    await app.inject({
      method: "POST", url: "/v1/auth/signup",
      payload: { email: "dupe@example.com", password: "password1" }
    });
    // Second signup with same email
    const res = await app.inject({
      method: "POST", url: "/v1/auth/signup",
      payload: { email: "dupe@example.com", password: "password2" }
    });
    assert.equal(res.statusCode, 409);
    assert.equal(JSON.parse(res.payload).ok, false);
    await app.close();
  });

  test("Returns 400 when email is missing", async () => {
    const app = await buildApp("auth");
    const res = await app.inject({
      method: "POST", url: "/v1/auth/signup",
      payload: { password: "pass1" }
    });
    assert.equal(res.statusCode, 400);
    await app.close();
  });

  test("Returns 400 when password is missing", async () => {
    const app = await buildApp("auth");
    const res = await app.inject({
      method: "POST", url: "/v1/auth/signup",
      payload: { email: "nopass@example.com" }
    });
    assert.equal(res.statusCode, 400);
    await app.close();
  });
});

describe("POST /v1/auth/login", () => {
  test("Returns 200 + JWT cookie on correct credentials", async () => {
    const app = await buildApp("auth");
    // Create a user first
    await app.inject({
      method: "POST", url: "/v1/auth/signup",
      payload: { email: "bob@example.com", password: "correctpass" }
    });
    // Now login
    const res = await app.inject({
      method: "POST", url: "/v1/auth/login",
      payload: { email: "bob@example.com", password: "correctpass" }
    });
    const body = JSON.parse(res.payload);
    assert.equal(res.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.user.email, "bob@example.com");
    const cookies = res.headers["set-cookie"] as string | string[];
    const cookieStr = Array.isArray(cookies) ? cookies.join("; ") : cookies;
    assert.ok(cookieStr?.includes("mf_session="), "Should set mf_session cookie");
    await app.close();
  });

  test("Returns 401 on wrong password", async () => {
    const app = await buildApp("auth");
    await app.inject({
      method: "POST", url: "/v1/auth/signup",
      payload: { email: "charlie@example.com", password: "rightpass" }
    });
    const res = await app.inject({
      method: "POST", url: "/v1/auth/login",
      payload: { email: "charlie@example.com", password: "wrongpass" }
    });
    assert.equal(res.statusCode, 401);
    assert.equal(JSON.parse(res.payload).ok, false);
    await app.close();
  });

  test("Returns 401 for unknown email", async () => {
    const app = await buildApp("auth");
    const res = await app.inject({
      method: "POST", url: "/v1/auth/login",
      payload: { email: "ghost@example.com", password: "anything" }
    });
    assert.equal(res.statusCode, 401);
    await app.close();
  });

  test("Returns 400 when credentials are missing", async () => {
    const app = await buildApp("auth");
    const res = await app.inject({
      method: "POST", url: "/v1/auth/login",
      payload: {}
    });
    assert.equal(res.statusCode, 400);
    await app.close();
  });
});

describe("POST /v1/auth/logout", () => {
  test("Clears session cookie and returns ok", async () => {
    const app = await buildApp("auth");
    const res = await app.inject({ method: "POST", url: "/v1/auth/logout" });
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.payload).ok, true);
    await app.close();
  });
});

describe("GET /v1/auth/me", () => {
  test("Returns user when JWT is valid", async () => {
    const app = await buildApp("auth");
    // Signup to get a user
    const signupRes = await app.inject({
      method: "POST", url: "/v1/auth/signup",
      payload: { email: "dana@example.com", password: "mypassword" }
    });
    const cookies = signupRes.headers["set-cookie"] as string[];
    const sessionCookie = (Array.isArray(cookies) ? cookies : [cookies])
      .find(c => c.startsWith("mf_session="))
      ?.split(";")[0] ?? "";

    const meRes = await app.inject({
      method:  "GET",
      url:     "/v1/auth/me",
      headers: { cookie: sessionCookie }
    });
    const body = JSON.parse(meRes.payload);
    assert.equal(meRes.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.user.email, "dana@example.com");
    await app.close();
  });

  test("Returns 401 without a token", async () => {
    const app = await buildApp("auth");
    const res = await app.inject({ method: "GET", url: "/v1/auth/me" });
    assert.equal(res.statusCode, 401);
    await app.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SHOPIFY WEBHOOK — orders/create
// ─────────────────────────────────────────────────────────────────────────────

// Must match SHOPIFY_API_SECRET in buildApp config stub — that's what verifyWebhook() uses
const SHOPIFY_WEBHOOK_SECRET = "test-shopify-secret";

function shopifyHmac(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64");
}

const SAMPLE_ORDER = JSON.stringify({
  id:               12345,
  financial_status: "paid",
  currency:         "USD",
  created_at:       new Date().toISOString(),
  line_items:       [{
    variant_id: 0, product_id: 111, quantity: 2, price: "29.99"
  }]
});

describe("POST /webhooks/shopify/orders/create", () => {
  test("Returns 200 and processes a valid order", async () => {
    const app   = await buildApp("shopify");
    const hmac  = shopifyHmac(SAMPLE_ORDER, SHOPIFY_WEBHOOK_SECRET);

    // Pre-seed a ProductMeta so the revenue update can find it
    const prisma = (app as any).prisma;
    prisma._productMeta.set("store_1_111", {
      id: "pm_1", storeId: "store_1", externalId: "111",
      title: "Test Product", isActive: true, archivedAt: null,
      sku: null, imageUrl: null, productUrl: null
    });

    const res = await app.inject({
      method:  "POST",
      url:     "/webhooks/shopify/orders/create",
      headers: {
        "content-type":              "application/json",
        "x-shopify-hmac-sha256":     hmac,
        "x-shopify-shop-domain":     "testshop.myshopify.com",
        "x-shopify-topic":           "orders/create",
      },
      payload: SAMPLE_ORDER
    });

    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.payload).ok, true);
    await app.close();
  });

  test("Returns 401 for invalid HMAC signature", async () => {
    const app = await buildApp("shopify");
    const res = await app.inject({
      method:  "POST",
      url:     "/webhooks/shopify/orders/create",
      headers: {
        "content-type":          "application/json",
        "x-shopify-hmac-sha256": "invalidsignature==",
        "x-shopify-shop-domain": "testshop.myshopify.com",
        "x-shopify-topic":       "orders/create",
      },
      payload: SAMPLE_ORDER
    });
    assert.equal(res.statusCode, 401);
    await app.close();
  });

  test("Idempotency — second delivery with same order ID returns 200 but skips processing", async () => {
    const app  = await buildApp("shopify");
    const hmac = shopifyHmac(SAMPLE_ORDER, SHOPIFY_WEBHOOK_SECRET);
    const headers = {
      "content-type":          "application/json",
      "x-shopify-hmac-sha256": hmac,
      "x-shopify-shop-domain": "testshop.myshopify.com",
      "x-shopify-topic":       "orders/create",
    };

    // First delivery
    const res1 = await app.inject({ method: "POST", url: "/webhooks/shopify/orders/create", headers, payload: SAMPLE_ORDER });
    assert.equal(res1.statusCode, 200);

    // Second delivery (simulated retry from Shopify)
    const res2 = await app.inject({ method: "POST", url: "/webhooks/shopify/orders/create", headers, payload: SAMPLE_ORDER });
    assert.equal(res2.statusCode, 200, "Should still ack 200 on duplicate");

    // Verify the Redis key was set (idempotency key exists)
    const redis = (app as any).redis;
    const redisKey = `webhook:order:12345`;
    const val = await redis.get(redisKey);
    assert.equal(val, "1", "Idempotency key should be in Redis");

    await app.close();
  });

  test("Ignores non-paid orders (status != paid)", async () => {
    const app  = await buildApp("shopify");
    const unpaidOrder = JSON.stringify({
      id: 99999, financial_status: "pending", currency: "USD",
      created_at: new Date().toISOString(), line_items: []
    });
    const hmac = shopifyHmac(unpaidOrder, SHOPIFY_WEBHOOK_SECRET);

    const res = await app.inject({
      method:  "POST",
      url:     "/webhooks/shopify/orders/create",
      headers: {
        "content-type":          "application/json",
        "x-shopify-hmac-sha256": hmac,
        "x-shopify-shop-domain": "testshop.myshopify.com",
        "x-shopify-topic":       "orders/create",
      },
      payload: unpaidOrder
    });
    assert.equal(res.statusCode, 200);
    await app.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WOOCOMMERCE WEBHOOKS
// ─────────────────────────────────────────────────────────────────────────────

const WOO_SECRET = "test-woo-secret-32charslongXYZABC";

function wooHmac(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64");
}

const WOO_PRODUCT_PAYLOAD = JSON.stringify({
  id: 42, name: "Widget Pro", sku: "WGT-PRO",
  status: "publish",
  description: "A great widget",
  short_description: "",
  images: [{ src: "https://example.com/img.jpg" }],
  price: "19.99", regular_price: "19.99",
  stock_quantity: 50, manage_stock: true,
  permalink: "https://mystore.com/widget-pro",
  variations: []
});

describe("POST /webhooks/woocommerce/products/created", () => {
  test("Returns 200 and upserts product on valid signature", async () => {
    const app  = await buildApp("woo");
    const hmac = wooHmac(WOO_PRODUCT_PAYLOAD, WOO_SECRET);

    const res = await app.inject({
      method:  "POST",
      url:     "/webhooks/woocommerce/products/created",
      headers: {
        "content-type":               "application/json",
        "x-wc-webhook-signature":     hmac,
        "x-wc-webhook-source":        "https://mystore.com",
        "x-wc-webhook-delivery-id":   "delivery-abc-001",
        "x-wc-webhook-topic":         "product.created",
      },
      payload: WOO_PRODUCT_PAYLOAD
    });

    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.payload).ok, true);

    // Verify product was upserted
    const prisma = (app as any).prisma;
    const key = "store_woo_1_42";
    const pm = prisma._productMeta.get(key);
    assert.ok(pm, "ProductMeta should have been created");
    assert.equal(pm.title, "Widget Pro");
    assert.equal(pm.isActive, true);
    await app.close();
  });

  test("Returns 401 for invalid signature", async () => {
    const app = await buildApp("woo");
    const res = await app.inject({
      method:  "POST",
      url:     "/webhooks/woocommerce/products/created",
      headers: {
        "content-type":             "application/json",
        "x-wc-webhook-signature":   "badsignature==",
        "x-wc-webhook-source":      "https://mystore.com",
        "x-wc-webhook-delivery-id": "delivery-bad-001",
        "x-wc-webhook-topic":       "product.created",
      },
      payload: WOO_PRODUCT_PAYLOAD
    });
    assert.equal(res.statusCode, 401);
    await app.close();
  });

  test("Soft-deletes product when status is trash", async () => {
    const app  = await buildApp("woo");
    const trashed = JSON.stringify({ ...JSON.parse(WOO_PRODUCT_PAYLOAD), status: "trash" });
    const hmac = wooHmac(trashed, WOO_SECRET);

    const res = await app.inject({
      method:  "POST",
      url:     "/webhooks/woocommerce/products/updated",
      headers: {
        "content-type":             "application/json",
        "x-wc-webhook-signature":   hmac,
        "x-wc-webhook-source":      "https://mystore.com",
        "x-wc-webhook-delivery-id": "delivery-trash-001",
        "x-wc-webhook-topic":       "product.updated",
      },
      payload: trashed
    });

    assert.equal(res.statusCode, 200);
    const prisma = (app as any).prisma;
    const pm = prisma._productMeta.get("store_woo_1_42");
    assert.ok(pm, "ProductMeta should exist");
    assert.equal(pm.isActive, false, "Should be soft-deleted when status is trash");
    assert.ok(pm.archivedAt instanceof Date, "archivedAt should be set");
    await app.close();
  });

  test("Idempotency — duplicate delivery-id is skipped", async () => {
    const app  = await buildApp("woo");
    const hmac = wooHmac(WOO_PRODUCT_PAYLOAD, WOO_SECRET);
    const headers = {
      "content-type":             "application/json",
      "x-wc-webhook-signature":   hmac,
      "x-wc-webhook-source":      "https://mystore.com",
      "x-wc-webhook-delivery-id": "delivery-dup-999",
      "x-wc-webhook-topic":       "product.created",
    };

    // First delivery
    await app.inject({ method: "POST", url: "/webhooks/woocommerce/products/created", headers, payload: WOO_PRODUCT_PAYLOAD });
    // Rename product between deliveries to detect if second delivery re-processes
    const prisma = (app as any).prisma;
    const pm = prisma._productMeta.get("store_woo_1_42");
    if (pm) prisma._productMeta.set("store_woo_1_42", { ...pm, title: "MUTATED" });

    // Second (duplicate) delivery
    const res2 = await app.inject({ method: "POST", url: "/webhooks/woocommerce/products/created", headers, payload: WOO_PRODUCT_PAYLOAD });
    assert.equal(res2.statusCode, 200, "Should ack 200 on duplicate");

    // Confirm the product title was NOT overwritten back to "Widget Pro"
    const pmAfter = prisma._productMeta.get("store_woo_1_42");
    assert.equal(pmAfter?.title, "MUTATED", "Duplicate delivery should not re-process");
    await app.close();
  });
});

describe("POST /webhooks/woocommerce/orders/created", () => {
  const WOO_ORDER = JSON.stringify({
    id:           77,
    status:       "completed",
    currency:     "USD",
    total:        "59.98",
    date_created: new Date().toISOString(),
    line_items:   [{ product_id: 42, variation_id: 0, quantity: 2, total: "59.98" }]
  });

  test("Updates DailyMetric revenue for a completed order", async () => {
    const app  = await buildApp("woo");
    const hmac = wooHmac(WOO_ORDER, WOO_SECRET);

    // Pre-seed ProductMeta for externalId "42"
    const prisma = (app as any).prisma;
    prisma._productMeta.set("store_woo_1_42", {
      id: "pm_woo_1", storeId: "store_woo_1", externalId: "42",
      title: "Widget Pro", isActive: true, archivedAt: null,
      sku: null, imageUrl: null, productUrl: null
    });

    const res = await app.inject({
      method:  "POST",
      url:     "/webhooks/woocommerce/orders/created",
      headers: {
        "content-type":             "application/json",
        "x-wc-webhook-signature":   hmac,
        "x-wc-webhook-source":      "https://mystore.com",
        "x-wc-webhook-delivery-id": "order-delivery-001",
        "x-wc-webhook-topic":       "order.created",
      },
      payload: WOO_ORDER
    });

    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.payload).ok, true);

    // Confirm a DailyMetric row was created with revenue
    let found = false;
    for (const [, metric] of prisma._metrics) {
      if (metric.storeId === "store_woo_1" && metric.productId === "pm_woo_1") {
        assert.ok(metric.revenue > 0, "Revenue should be > 0");
        found = true;
      }
    }
    assert.ok(found, "DailyMetric row should have been created");
    await app.close();
  });

  test("Ignores pending/cancelled orders", async () => {
    const app    = await buildApp("woo");
    const pending = JSON.stringify({ ...JSON.parse(WOO_ORDER), id: 78, status: "pending" });
    const hmac   = wooHmac(pending, WOO_SECRET);

    const res = await app.inject({
      method:  "POST",
      url:     "/webhooks/woocommerce/orders/created",
      headers: {
        "content-type":             "application/json",
        "x-wc-webhook-signature":   hmac,
        "x-wc-webhook-source":      "https://mystore.com",
        "x-wc-webhook-delivery-id": "order-pending-001",
        "x-wc-webhook-topic":       "order.created",
      },
      payload: pending
    });

    assert.equal(res.statusCode, 200);
    // Confirm no metrics were written
    const prisma = (app as any).prisma;
    assert.equal(prisma._metrics.size, 0, "No metrics should be written for pending orders");
    await app.close();
  });
});
