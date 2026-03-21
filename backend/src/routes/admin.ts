import type { FastifyInstance } from "fastify";
import { decryptToken } from "../utils/crypto.js";

type AdminPayload = { sub: string; email: string; role: string };

async function verifyAdmin(
  app: FastifyInstance,
  request: any,
  reply: any
): Promise<AdminPayload | null> {
  try {
    const payload = await request.jwtVerify<AdminPayload>();
    if (!payload?.sub) {
      reply.code(401).send({ ok: false, message: "Unauthorized" });
      return null;
    }
    // Fast path: JWT role claim is present and says ADMIN.
    // Fallback: always confirm against the DB so a downgraded admin's stale
    // session can't reach admin routes until their token expires.
    if (payload.role !== "ADMIN") {
      reply.code(403).send({ ok: false, message: "Forbidden: Admin access required" });
      return null;
    }
    const dbUser = await app.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { role: true }
    });
    if (dbUser?.role !== "ADMIN") {
      reply.code(403).send({ ok: false, message: "Forbidden: Admin access required" });
      return null;
    }
    return payload;
  } catch {
    reply.code(401).send({ ok: false, message: "Unauthorized" });
    return null;
  }
}

export async function adminRoutes(app: FastifyInstance) {
  /**
   * GET /admin/stats
   * Platform-wide overview statistics
   */
  app.get("/admin/stats", async (request, reply) => {
    const admin = await verifyAdmin(app, request, reply);
    if (!admin) return;

    const [
      totalUsers,
      totalStores,
      totalProducts,
      totalConnections,
      adminCount,
      platformBreakdown,
      recentUsers,
      recentActivity,
      lastRollupLog,
      rollupStaleCount,
    ] = await Promise.all([
      app.prisma.user.count(),
      app.prisma.store.count(),
      app.prisma.productMeta.count(),
      app.prisma.connection.count(),
      app.prisma.user.count({ where: { role: "ADMIN" } }),
      app.prisma.store.groupBy({
        by: ["platform"],
        _count: { id: true },
      }),
      app.prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          plan: true,
          createdAt: true,
          _count: { select: { stores: true } },
        },
      }),
      app.prisma.auditLog.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        include: {
          store: {
            select: {
              id: true,
              name: true,
              platform: true,
              owner: { select: { email: true, name: true } },
            },
          },
        },
      }),
      app.prisma.auditLog.findFirst({
        where: { action: "Rollup Complete" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, metadata: true }
      }),
      app.prisma.store.count({
        where: { OR: [{ lastRollupStatus: null }, { lastRollupStatus: { not: "SUCCESS" } }] }
      }),
    ]);

    return reply.send({
      ok: true,
      stats: {
        totalUsers,
        totalStores,
        totalProducts,
        totalConnections,
        adminCount,
        platformBreakdown: platformBreakdown.map((p) => ({
          platform: p.platform,
          count: p._count.id,
        })),
        recentUsers,
        recentActivity,
        rollup: lastRollupLog
          ? {
              lastAt: lastRollupLog.createdAt,
              rows: (lastRollupLog.metadata as any)?.rows ?? null,
              durationMs: (lastRollupLog.metadata as any)?.durationMs ?? null,
              staleStores: rollupStaleCount,
            }
          : { lastAt: null, rows: null, durationMs: null, staleStores: rollupStaleCount },
      },
    });
  });

  /**
   * GET /admin/activity
   * Recent audit logs across all stores with pagination
   */
  app.get("/admin/activity", async (request, reply) => {
    const admin = await verifyAdmin(app, request, reply);
    if (!admin) return;

    const { limit = "50", cursor } = request.query as {
      limit?: string;
      cursor?: string;
    };
    const take = Math.min(parseInt(limit, 10), 100);

    const logs = await app.prisma.auditLog.findMany({
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: "desc" },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            platform: true,
            owner: { select: { id: true, email: true, name: true } },
          },
        },
      },
    });

    const nextCursor = logs.length === take ? logs[logs.length - 1].id : null;

    return reply.send({ ok: true, logs, nextCursor });
  });

  /**
   * GET /admin/users
   * List all users with pagination and search
   */
  app.get("/admin/users", async (request, reply) => {
    const admin = await verifyAdmin(app, request, reply);
    if (!admin) return;

    const { search, limit = "20", cursor } = request.query as {
      search?: string;
      limit?: string;
      cursor?: string;
    };
    const take = Math.min(parseInt(limit, 10), 100);

    const where =
      search
        ? {
            OR: [
              { email: { contains: search, mode: "insensitive" as const } },
              { name: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : undefined;

    const [users, total] = await Promise.all([
      app.prisma.user.findMany({
        take,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        where,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          plan: true,
          createdAt: true,
          _count: { select: { stores: true } },
        },
      }),
      app.prisma.user.count({ where }),
    ]);

    const nextCursor = users.length === take ? users[users.length - 1].id : null;

    return reply.send({ ok: true, users, nextCursor, total });
  });

  /**
   * GET /admin/users/:userId
   * Get a specific user with their stores and connections
   */
  app.get("/admin/users/:userId", async (request, reply) => {
    const admin = await verifyAdmin(app, request, reply);
    if (!admin) return;

    const { userId } = request.params as { userId: string };

    const user = await app.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        plan: true,
        frozenAt: true,
        trialEndsAt: true,
        createdAt: true,
        updatedAt: true,
        stores: {
          include: {
            connections: { select: { id: true, provider: true, createdAt: true, updatedAt: true } },
            _count: { select: { products: true, dailyMetrics: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { stores: true } },
      },
    });

    if (!user) {
      return reply.code(404).send({ ok: false, message: "User not found" });
    }

    return reply.send({ ok: true, user });
  });

  /**
   * PATCH /admin/users/:userId
   * Update user role or name
   */
  app.patch("/admin/users/:userId", async (request, reply) => {
    const admin = await verifyAdmin(app, request, reply);
    if (!admin) return;

    const { userId } = request.params as { userId: string };
    const body = request.body as {
      role?: "USER" | "ADMIN";
      name?: string;
      plan?: "STARTER" | "GROWTH" | "SCALE" | "GRANDFATHERED";
    };

    const VALID_PLANS = ["STARTER", "GROWTH", "SCALE", "GRANDFATHERED"];

    if (!body.role && !body.name && !body.plan) {
      return reply.code(400).send({ ok: false, message: "Nothing to update" });
    }

    if (body.plan && !VALID_PLANS.includes(body.plan)) {
      return reply.code(400).send({ ok: false, message: `plan must be one of: ${VALID_PLANS.join(", ")}` });
    }

    // Prevent self-demotion
    if (body.role && userId === admin.sub && body.role !== "ADMIN") {
      return reply.code(400).send({ ok: false, message: "Cannot change your own role" });
    }

    const existing = await app.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      return reply.code(404).send({ ok: false, message: "User not found" });
    }

    const updated = await app.prisma.user.update({
      where: { id: userId },
      data: {
        ...(body.role && { role: body.role }),
        ...(body.name?.trim() && { name: body.name.trim() }),
        ...(body.plan && { plan: body.plan }),
      },
      select: { id: true, email: true, name: true, role: true, plan: true, createdAt: true },
    });

    app.log.info({ userId, updatedBy: admin.sub, role: body.role, plan: body.plan }, "Admin updated user");

    // Write a durable audit entry for plan and role changes so there is a clear
    // record of who changed what and when (compliance + support investigations).
    const auditParts: string[] = [];
    if (body.plan && body.plan !== existing.plan) {
      auditParts.push(`plan: ${existing.plan} → ${body.plan}`);
    }
    if (body.role && body.role !== existing.role) {
      auditParts.push(`role: ${existing.role} → ${body.role}`);
    }
    if (auditParts.length > 0) {
      // User-level changes don't have a storeId, so we write one entry per store
      // they own. If they have no stores, we still want a record — use a system log.
      const userStores = await app.prisma.store.findMany({
        where: { ownerId: userId },
        select: { id: true }
      });
      const auditDetail = `Admin (${admin.sub}) updated user ${userId} (${existing.email}): ${auditParts.join("; ")}`;
      if (userStores.length > 0) {
        await Promise.all(
          userStores.map((s: { id: string }) =>
            app.prisma.auditLog.create({
              data: { storeId: s.id, action: "admin.user.updated", detail: auditDetail,
                metadata: { adminId: admin.sub, userId, changes: auditParts } }
            }).catch(() => {})
          )
        );
      } else {
        app.log.info({ auditDetail }, "Admin updated user (no stores to attach audit log to)");
      }
    }

    return reply.send({ ok: true, user: updated });
  });

  /**
   * DELETE /admin/users/:userId
   * Delete a user and all their data (full cascade)
   */
  app.delete("/admin/users/:userId", async (request, reply) => {
    const admin = await verifyAdmin(app, request, reply);
    if (!admin) return;

    const { userId } = request.params as { userId: string };

    if (userId === admin.sub) {
      return reply.code(400).send({ ok: false, message: "Cannot delete your own account" });
    }

    const user = await app.prisma.user.findUnique({
      where: { id: userId },
      include: { stores: { select: { id: true } } },
    });

    if (!user) {
      return reply.code(404).send({ ok: false, message: "User not found" });
    }

    // Cascade delete each store's data
    for (const store of user.stores) {
      await app.prisma.$transaction([
        app.prisma.auditLog.deleteMany({ where: { storeId: store.id } }),
        app.prisma.dailyMetric.deleteMany({ where: { storeId: store.id } }),
        app.prisma.productMeta.deleteMany({ where: { storeId: store.id } }),
        app.prisma.connection.deleteMany({ where: { storeId: store.id } }),
        app.prisma.store.delete({ where: { id: store.id } }),
      ]);
    }

    // Delete reset tokens and user
    await app.prisma.$transaction([
      app.prisma.passwordResetToken.deleteMany({ where: { userId } }),
      app.prisma.user.delete({ where: { id: userId } }),
    ]);

    app.log.info({ userId, deletedBy: admin.sub }, "Admin deleted user");

    return reply.send({ ok: true });
  });

  /**
   * PATCH /admin/users/:userId/freeze
   * Freeze or unfreeze a user account (sets/clears frozenAt timestamp).
   * Body: { frozen: true | false }
   * Requires explicit intent — toggle semantics would allow a replayed request
   * to silently reverse the operation (freeze→unfreeze or vice-versa).
   */
  app.patch("/admin/users/:userId/freeze", async (request, reply) => {
    const admin = await verifyAdmin(app, request, reply);
    if (!admin) return;

    const { userId } = request.params as { userId: string };
    const { frozen } = (request.body ?? {}) as { frozen?: boolean };

    if (typeof frozen !== "boolean") {
      return reply.code(400).send({ ok: false, message: "frozen (boolean) is required" });
    }
    if (userId === admin.sub) {
      return reply.code(400).send({ ok: false, message: "Cannot freeze your own account" });
    }

    const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return reply.code(404).send({ ok: false, message: "User not found" });

    const frozenAt = frozen ? new Date() : null;
    const updated = await app.prisma.user.update({
      where: { id: userId },
      data: { frozenAt },
      select: { id: true, email: true, frozenAt: true }
    });

    const action = frozen ? "frozen" : "unfrozen";
    app.log.info({ userId, action, doneBy: admin.sub }, `Admin ${action} user`);

    return reply.send({ ok: true, frozen, frozenAt: updated.frozenAt });
  });

  /**
   * PATCH /admin/users/:userId/trial
   * Set a trial end date for a user (null to remove trial)
   */
  app.patch("/admin/users/:userId/trial", async (request, reply) => {
    const admin = await verifyAdmin(app, request, reply);
    if (!admin) return;

    const { userId } = request.params as { userId: string };
    const { trialEndsAt } = request.body as { trialEndsAt?: string | null };

    const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return reply.code(404).send({ ok: false, message: "User not found" });

    let trialDate: Date | null = null;
    if (trialEndsAt) {
      trialDate = new Date(trialEndsAt);
      if (isNaN(trialDate.getTime())) {
        return reply.code(400).send({ ok: false, message: "Invalid trialEndsAt date" });
      }
    }

    const updated = await app.prisma.user.update({
      where: { id: userId },
      data: { trialEndsAt: trialDate },
      select: { id: true, email: true, trialEndsAt: true }
    });

    app.log.info({ userId, trialEndsAt: trialDate, setBy: admin.sub }, "Admin updated trial");

    return reply.send({ ok: true, trialEndsAt: updated.trialEndsAt });
  });

  /**
   * DELETE /admin/users/:userId/settings
   * Reset a user's automation settings to defaults (deletes UserSettings row — recreated on next access)
   */
  app.delete("/admin/users/:userId/settings", async (request, reply) => {
    const admin = await verifyAdmin(app, request, reply);
    if (!admin) return;

    const { userId } = request.params as { userId: string };

    const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return reply.code(404).send({ ok: false, message: "User not found" });

    await app.prisma.userSettings.deleteMany({ where: { userId } });

    app.log.info({ userId, resetBy: admin.sub }, "Admin reset user settings");

    return reply.send({ ok: true, message: "Settings reset to defaults" });
  });

  /**
   * GET /admin/stores
   * List all stores across all users with pagination, search, and platform filter
   */
  app.get("/admin/stores", async (request, reply) => {
    const admin = await verifyAdmin(app, request, reply);
    if (!admin) return;

    const { search, platform, limit = "20", cursor } = request.query as {
      search?: string;
      platform?: string;
      limit?: string;
      cursor?: string;
    };
    const take = Math.min(parseInt(limit, 10), 100);

    const validPlatforms = ["SHOPIFY", "WOOCOMMERCE", "API"];
    const platformFilter =
      platform && validPlatforms.includes(platform.toUpperCase())
        ? (platform.toUpperCase() as "SHOPIFY" | "WOOCOMMERCE" | "API")
        : undefined;

    const where: Parameters<typeof app.prisma.store.findMany>[0]["where"] = {
      ...(platformFilter ? { platform: platformFilter } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { storeUrl: { contains: search, mode: "insensitive" } },
              { owner: { email: { contains: search, mode: "insensitive" } } },
              { owner: { name: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [stores, total] = await Promise.all([
      app.prisma.store.findMany({
        take,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        where,
        orderBy: { createdAt: "desc" },
        include: {
          owner: { select: { id: true, email: true, name: true } },
          connections: { select: { id: true, provider: true } },
          _count: { select: { products: true } },
        },
      }),
      app.prisma.store.count({ where }),
    ]);

    const nextCursor = stores.length === take ? stores[stores.length - 1].id : null;

    return reply.send({ ok: true, stores, nextCursor, total });
  });

  /**
   * DELETE /admin/stores/:storeId
   * Delete any store (admin override, no ownership check)
   */
  app.delete("/admin/stores/:storeId", async (request, reply) => {
    const admin = await verifyAdmin(app, request, reply);
    if (!admin) return;

    const { storeId } = request.params as { storeId: string };

    const store = await app.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) {
      return reply.code(404).send({ ok: false, message: "Store not found" });
    }

    // Write audit log BEFORE the cascade delete — the store (and its audit rows)
    // are removed in the transaction below, so logging afterwards is impossible.
    await app.prisma.auditLog.create({
      data: {
        action: "admin.store.deleted",
        detail: `Admin ${admin.email} permanently deleted store "${store.name}" (${storeId})`,
        metadata: { storeId, storeName: store.name, platform: store.platform, deletedBy: admin.sub, adminEmail: admin.email },
        storeId,
      }
    }).catch((err: Error) =>
      app.log.warn({ err, storeId }, "[admin] Pre-delete audit log write failed — continuing with delete")
    );

    await app.prisma.$transaction([
      app.prisma.auditLog.deleteMany({ where: { storeId } }),
      app.prisma.dailyMetric.deleteMany({ where: { storeId } }),
      app.prisma.productMeta.deleteMany({ where: { storeId } }),
      app.prisma.connection.deleteMany({ where: { storeId } }),
      app.prisma.store.delete({ where: { id: storeId } }),
    ]);

    app.log.info({ storeId, storeName: store.name, deletedBy: admin.sub }, "Admin deleted store");

    return reply.send({ ok: true });
  });

  /**
   * POST /admin/sync-store/:storeId
   * Immediately enqueue a full sync for any store — bypasses the 6-hour user cooldown.
   * Optionally restrict to a single provider via ?provider=META|SHOPIFY|WOOCOMMERCE
   */
  app.post("/admin/sync-store/:storeId", async (request, reply) => {
    const admin = await verifyAdmin(app, request, reply);
    if (!admin) return;

    const { storeId } = request.params as { storeId: string };
    const { provider: filterProvider } = request.query as { provider?: string };

    const store = await app.prisma.store.findUnique({
      where: { id: storeId },
      include: { connections: true }
    });
    if (!store) return reply.code(404).send({ ok: false, message: "Store not found" });

    const enqueued: string[] = [];

    for (const conn of store.connections) {
      if (filterProvider && conn.provider !== filterProvider.toUpperCase()) continue;
      const token = decryptToken(conn.accessToken);

      if (conn.provider === "SHOPIFY") {
        const shop = store.storeUrl.replace(/https?:\/\//, "").replace(/\/$/, "");
        await app.queues.syncQueue.add(
          "shopify-sync",
          { storeId, provider: "SHOPIFY", shop, accessToken: token },
          { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
        );
        enqueued.push("SHOPIFY");
      } else if (conn.provider === "WOOCOMMERCE") {
        await app.queues.syncQueue.add(
          "woocommerce-sync",
          { storeId, provider: "WOOCOMMERCE", storeUrl: store.storeUrl, accessToken: token },
          { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
        );
        enqueued.push("WOOCOMMERCE");
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
        enqueued.push("META");
      }
    }

    // Enqueue scoring pass after sync finishes
    if (enqueued.length > 0) {
      await app.queues.scoringQueue.add(
        "score-store",
        { storeId },
        { delay: 30000, attempts: 2 }
      );
      await app.prisma.store.update({
        where: { id: storeId },
        data: { lastSyncAt: new Date() }
      });
    }

    app.log.info({ storeId, enqueued, triggeredBy: admin.sub }, "Admin forced sync");

    return reply.send({
      ok: true,
      message: enqueued.length > 0
        ? `Sync enqueued for: ${enqueued.join(", ")}`
        : "No matching connections found",
      enqueued
    });
  });
}
