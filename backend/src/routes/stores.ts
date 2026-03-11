import type { FastifyInstance } from "fastify";

const VALID_PLATFORMS = ["SHOPIFY", "WOOCOMMERCE", "API"] as const;
type StorePlatform = (typeof VALID_PLATFORMS)[number];

export async function storeRoutes(app: FastifyInstance) {
  /**
   * GET /stores
   * List all stores for the authenticated user, including connections and product count.
   */
  app.get("/stores", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();

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

    if (!VALID_PLATFORMS.includes(platform)) {
      return reply.code(400).send({
        ok: false,
        message: `platform must be one of: ${VALID_PLATFORMS.join(", ")}`
      });
    }

    try {
      const store = await app.prisma.store.create({
        data: { name, platform, storeUrl, currency, ownerId: payload.sub }
      });
      app.log.info({ storeId: store.id, platform }, "Store created");
      return reply.code(201).send({ ok: true, store });
    } catch (err) {
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

      const store = await app.prisma.store.update({
        where: { id: storeId },
        data: {
          ...(body.name?.trim() && { name: body.name.trim() }),
          ...(body.storeUrl?.trim() && { storeUrl: body.storeUrl.trim() }),
          ...(body.currency?.trim() && { currency: body.currency.trim().toUpperCase() })
        }
      });

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
      const { storeId } = request.params as { storeId: string };
      const now = new Date();
      const COOLDOWN_HOURS = 6;
      const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;

      const store = await app.prisma.store.findFirst({
        where: { id: storeId, ownerId: payload.sub },
        include: { connections: true }
      });

      if (!store) {
        return reply.code(404).send({ ok: false, message: "Store not found" });
      }

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

      // Enqueue platform sync jobs for each connected provider
      for (const conn of store.connections) {
        if (conn.provider === "SHOPIFY") {
          const shop = store.storeUrl.replace(/https?:\/\//, "").replace(/\/$/, "");
          await app.queues.syncQueue.add(
            "shopify-sync",
            { storeId, provider: "SHOPIFY", shop, accessToken: conn.accessToken },
            { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
          );
        } else if (conn.provider === "WOOCOMMERCE") {
          await app.queues.syncQueue.add(
            "woocommerce-sync",
            { storeId, provider: "WOOCOMMERCE", storeUrl: store.storeUrl, accessToken: conn.accessToken },
            { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
          );
        } else if (conn.provider === "META") {
          await app.queues.syncQueue.add(
            "meta-sync",
            {
              storeId,
              provider: "META",
              accessToken: conn.accessToken,
              metaAdAccountId: conn.metaAdAccountId ?? null,
              metaCatalogId: conn.metaCatalogId ?? null,
            },
            { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
          );
        }
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
        data: { lastSyncAt: now }
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

      return reply.send({ ok: true, message: "Sync jobs enqueued" });
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });
}
