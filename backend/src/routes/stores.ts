import type { FastifyInstance } from "fastify";
import { decryptToken } from "../utils/crypto.js";
import { invalidateAnalyticsCache } from "./analytics.js";

const VALID_PLATFORMS = ["SHOPIFY", "WOOCOMMERCE", "API"] as const;
type StorePlatform = (typeof VALID_PLATFORMS)[number];

/** Maximum stores allowed per subscription plan. */
const PLAN_STORE_LIMITS: Record<string, number> = {
  STARTER: 1,
  GROWTH: 5,
  SCALE: Infinity,
  GRANDFATHERED: Infinity,
};

export async function storeRoutes(app: FastifyInstance) {
  /**
   * GET /stores
   * List all stores for the authenticated user, including connections and product count.
   */
  app.get("/stores", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      if (!payload?.sub) return reply.code(401).send({ ok: false, message: "Unauthorized" });

      const stores = await app.prisma.store.findMany({
        where: { ownerId: payload.sub },
        include: {
          connections: {
            select: {
              id: true,
              provider: true,
              scopes: true,
              expiresAt: true,
              createdAt: true,
              updatedAt: true
            }
          },
          _count: {
            select: { products: true }
          }
        },
        orderBy: { createdAt: "asc" }
      });

      return reply.send({ ok: true, stores });
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });

  /**
   * GET /stores/:storeId
   * Get a single store by ID (must belong to authenticated user).
   */
  app.get("/stores/:storeId", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      if (!payload?.sub) return reply.code(401).send({ ok: false, message: "Unauthorized" });
      const { storeId } = request.params as { storeId: string };

      const store = await app.prisma.store.findFirst({
        where: { id: storeId, ownerId: payload.sub },
        include: {
          connections: {
            select: {
              id: true,
              provider: true,
              scopes: true,
              expiresAt: true,
              createdAt: true,
              updatedAt: true
            }
          },
          _count: { select: { products: true, dailyMetrics: true } }
        }
      });

      if (!store) {
        return reply.code(404).send({ ok: false, message: "Store not found" });
      }

      return reply.send({ ok: true, store });
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });

  /**
   * POST /stores
   * Create a new store.
   *
   * Body: { name, platform, storeUrl, currency? }
   */
  app.post("/stores", async (request, reply) => {
    let payload: { sub: string };
    try {
      payload = await request.jwtVerify<{ sub: string }>();
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
    if (!payload?.sub) return reply.code(401).send({ ok: false, message: "Unauthorized" });

    const body = request.body as {
      name?: string;
      platform?: string;
      storeUrl?: string;
      currency?: string;
    };

    const name = body?.name?.trim();
    const platform = body?.platform?.trim().toUpperCase() as StorePlatform;
    const storeUrl = body?.storeUrl?.trim();
    const currency = body?.currency?.trim().toUpperCase() ?? "USD";

    if (!name || !platform || !storeUrl) {
      return reply.code(400).send({
        ok: false,
        message: "name, platform, and storeUrl are required"
      });
    }

    // Max-length guards — prevent DB bloat and log noise
    if (name.length > 200) {
      return reply.code(400).send({ ok: false, message: "name must be 200 characters or fewer" });
    }
    if (storeUrl.length > 500) {
      return reply.code(400).send({ ok: false, message: "storeUrl must be 500 characters or fewer" });
    }
    if (currency.length > 3) {
      return reply.code(400).send({ ok: false, message: "currency must be a valid 3-letter ISO code" });
    }

    // Validate storeUrl is a well-formed HTTP/HTTPS URL — reject javascript:, data:, etc.
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(storeUrl);
    } catch {
      return reply.code(400).send({ ok: false, message: "storeUrl must be a valid URL" });
    }
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return reply.code(400).send({ ok: false, message: "storeUrl must use http or https" });
    }

    if (!VALID_PLATFORMS.includes(platform)) {
      return reply.code(400).send({
        ok: false,
        message: `platform must be one of: ${VALID_PLATFORMS.join(", ")}`
      });
    }

    // Enforce per-plan store limit.
    // The count check and create are wrapped in a serializable transaction so
    // two concurrent POST /stores requests can't both slip through the limit guard
    // and create more stores than the plan allows (TOCTOU race condition).
    let planLimitMessage: string | null = null;
    try {
      const store = await app.prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: payload.sub },
          select: { plan: true }
        });
        const limit = PLAN_STORE_LIMITS[user?.plan ?? "STARTER"] ?? 1;
        const storeCount = await tx.store.count({ where: { ownerId: payload.sub } });
        if (storeCount >= limit) {
          planLimitMessage = `Your plan allows up to ${limit} store${limit === 1 ? "" : "s"}. Upgrade to add more.`;
          throw new Error("PLAN_LIMIT_EXCEEDED");
        }
        return tx.store.create({
          data: { name, platform, storeUrl, currency, ownerId: payload.sub }
        });
      }, { isolationLevel: "Serializable" });

      app.log.info({ storeId: store.id, platform }, "Store created");
      return reply.code(201).send({ ok: true, store });
    } catch (err: any) {
      if (err?.message === "PLAN_LIMIT_EXCEEDED") {
        return reply.code(403).send({
          ok: false,
          code: "PLAN_LIMIT",
          message: planLimitMessage ?? "Your plan limit has been reached. Upgrade to add more stores."
        });
      }
      app.log.error({ err }, "Failed to create store");
      return reply.code(500).send({ ok: false, message: "Internal server error" });
    }
  });

  /**
   * PATCH /stores/:storeId
   * Update a store's name, URL, or currency.
   *
   * Body: { name?, storeUrl?, currency? }
   */
  app.patch("/stores/:storeId", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      if (!payload?.sub) return reply.code(401).send({ ok: false, message: "Unauthorized" });
      const { storeId } = request.params as { storeId: string };
      const body = request.body as {
        name?: string;
        storeUrl?: string;
        currency?: string;
      };

      const existing = await app.prisma.store.findFirst({
        where: { id: storeId, ownerId: payload.sub }
      });

      if (!existing) {
        return reply.code(404).send({ ok: false, message: "Store not found" });
      }

      const changes: Record<string, unknown> = {};
      if (body.name?.trim()     && body.name.trim()     !== existing.name)     changes.name     = body.name.trim();
      if (body.storeUrl?.trim() && body.storeUrl.trim() !== existing.storeUrl) changes.storeUrl = body.storeUrl.trim();
      if (body.currency?.trim() && body.currency.trim().toUpperCase() !== existing.currency)
        changes.currency = body.currency.trim().toUpperCase();

      const store = await app.prisma.store.update({
        where: { id: storeId },
        data: changes
      });

      if (Object.keys(changes).length > 0) {
        await app.prisma.auditLog.create({
          data: {
            storeId,
            action: "store.updated",
            detail: `Updated: ${Object.keys(changes).join(", ")}`,
            metadata: { before: Object.fromEntries(Object.keys(changes).map(k => [k, (existing as Record<string, unknown>)[k]])), after: changes },
          }
        }).catch(() => {});
      }

      return reply.send({ ok: true, store });
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });

  /**
   * DELETE /stores/:storeId
   * Permanently delete a store and all its data.
   * Cascades: auditLogs → dailyMetrics → productMeta → connections → store
   */
  app.delete("/stores/:storeId", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      if (!payload?.sub) return reply.code(401).send({ ok: false, message: "Unauthorized" });
      const { storeId } = request.params as { storeId: string };

      const existing = await app.prisma.store.findFirst({
        where: { id: storeId, ownerId: payload.sub }
      });

      if (!existing) {
        return reply.code(404).send({ ok: false, message: "Store not found" });
      }

      // Manual cascade in dependency order
      await app.prisma.$transaction([
        app.prisma.auditLog.deleteMany({ where: { storeId } }),
        app.prisma.dailyMetric.deleteMany({ where: { storeId } }),
        app.prisma.productMeta.deleteMany({ where: { storeId } }),
        app.prisma.connection.deleteMany({ where: { storeId } }),
        app.prisma.store.delete({ where: { id: storeId } })
      ]);

      app.log.info({ storeId }, "Store deleted");

      return reply.send({ ok: true });
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });

  /**
   * POST /stores/:storeId/sync
   * Manually trigger a full data sync for a store.
   * Enqueues a sync job + scoring job.
   */
  app.post("/stores/:storeId/sync", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      if (!payload?.sub) return reply.code(401).send({ ok: false, message: "Unauthorized" });
      const { storeId } = request.params as { storeId: string };
      const COOLDOWN_HOURS = 6;
      const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;
      const cooldownSeconds = COOLDOWN_HOURS * 60 * 60;
      const lockKey = `sync:lock:${storeId}`;

      const store = await app.prisma.store.findFirst({
        where: { id: storeId, ownerId: payload.sub },
        include: { connections: true }
      });

      if (!store) {
        return reply.code(404).send({ ok: false, message: "Store not found" });
      }

      // Atomic cooldown using Redis SETNX with TTL
      try {
        const lock = await app.redis.set(lockKey, "1", "EX", cooldownSeconds, "NX");
        if (!lock) {
          const ttl = await app.redis.ttl(lockKey);
          return reply.code(429).send({
            ok: false,
            message: `Sync is limited to once every ${COOLDOWN_HOURS} hours. Please try again later.`,
            retryAfterSeconds: ttl > 0 ? ttl : cooldownSeconds
          });
        }
      } catch {
        // Redis unavailable — fallback to DB timestamp check
        const now = new Date();
        if (store.lastSyncAt) {
          const elapsed = now.getTime() - store.lastSyncAt.getTime();
          if (elapsed < cooldownMs) {
            const retryAfterSeconds = Math.ceil((cooldownMs - elapsed) / 1000);
            return reply.code(429).send({
              ok: false,
              message: `Sync is limited to once every ${COOLDOWN_HOURS} hours. Please try again later.`,
              retryAfterSeconds
            });
          }
        }
      }

      // Enqueue platform sync jobs — release the cooldown lock on failure so the
      // user can retry immediately rather than waiting the full cooldown period.
      try {
        for (const conn of store.connections) {
          const token = decryptToken(conn.accessToken);
          if (conn.provider === "SHOPIFY") {
            const shop = store.storeUrl.replace(/https?:\/\//, "").replace(/\/$/, "");
            await app.queues.syncQueue.add(
              "shopify-sync",
              { storeId, provider: "SHOPIFY", shop, accessToken: token },
              { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
            );
          } else if (conn.provider === "WOOCOMMERCE") {
            await app.queues.syncQueue.add(
              "woocommerce-sync",
              { storeId, provider: "WOOCOMMERCE", storeUrl: store.storeUrl, accessToken: token },
              { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
            );
          } else if (conn.provider === "META") {
            await app.queues.syncQueue.add(
              "meta-sync",
              {
                storeId,
                provider: "META",
                accessToken: token,
                metaAdAccountId: conn.metaAdAccountId ?? null,
                metaCatalogId: conn.metaCatalogId ?? null,
              },
              { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
            );
          }
        }
      } catch (queueErr) {
        // Queuing failed — release the cooldown lock so the user can retry.
        app.redis.del(lockKey).catch(() => {});
        throw queueErr;
      }

      // Always enqueue a scoring pass after sync (with a delay to let sync finish)
      await app.queues.scoringQueue.add(
        "score-store",
        { storeId },
        { delay: 30000, attempts: 2 }
      );

      await app.prisma.auditLog.create({
        data: {
          action: "SYNC_TRIGGERED",
          detail: `Manual sync triggered for store ${store.name}`,
          storeId
        }
      });

      await app.prisma.store.update({
        where: { id: storeId },
        data: { lastSyncAt: new Date() }
      });

      // Notify the store owner that import has started (non-blocking)
      const owner = await app.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { email: true, name: true }
      });
      if (owner) {
        app.mail.sendImportStarted(owner.email, owner.name ?? "", store.name).catch((err) =>
          app.log.error({ err }, "Failed to send import-started email")
        );
      }

      // Invalidate the analytics cache for this store so the next request
      // fetches fresh data after the sync completes
      invalidateAnalyticsCache(app, storeId).catch(() => {});

      return reply.send({ ok: true, message: "Sync jobs enqueued" });
    } catch {
      try { await app.redis.del(`sync:lock:${request.params["storeId"]}`); } catch {}
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });
}
