import type { FastifyInstance } from "fastify";

type AdminPayload = { sub: string; email: string; role: string };

async function verifyAdmin(
  _app: FastifyInstance,
  request: any,
  reply: any
): Promise<AdminPayload | null> {
  try {
    const payload = await request.jwtVerify<AdminPayload>();
    if (payload.role !== "ADMIN") {
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
    const take = Math.min(parseInt(limit), 100);

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
    const take = Math.min(parseInt(limit), 100);

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
        createdAt: true,
        updatedAt: true,
        stores: {
          include: {
            connections: { select: { id: true, provider: true, createdAt: true } },
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
    const body = request.body as { role?: "USER" | "ADMIN"; name?: string };

    if (!body.role && !body.name) {
      return reply.code(400).send({ ok: false, message: "Nothing to update" });
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
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    app.log.info({ userId, updatedBy: admin.sub, role: body.role }, "Admin updated user");

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
    const take = Math.min(parseInt(limit), 100);

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

    await app.prisma.$transaction([
      app.prisma.auditLog.deleteMany({ where: { storeId } }),
      app.prisma.dailyMetric.deleteMany({ where: { storeId } }),
      app.prisma.productMeta.deleteMany({ where: { storeId } }),
      app.prisma.connection.deleteMany({ where: { storeId } }),
      app.prisma.store.delete({ where: { id: storeId } }),
    ]);

    app.log.info({ storeId, deletedBy: admin.sub }, "Admin deleted store");

    return reply.send({ ok: true });
  });
}
