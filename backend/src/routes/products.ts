import type { FastifyInstance } from "fastify";

const VALID_SORT_FIELDS: Record<string, string> = {
  score: "score",
  title: "title",
  updatedAt: "updatedAt"
};

export async function productRoutes(app: FastifyInstance) {
  /**
   * GET /products
   *
   * Returns paginated product catalog for the authenticated user's store,
   * joined with their most recent daily metrics.
   *
   * Query params:
   *   storeId?    — defaults to first store
   *   range?      — "7d" | "30d" | "90d" (default: "30d")
   *   sortBy?     — "score" | "title" | "updatedAt" (default: "score")
   *   sortDir?    — "asc" | "desc" (default: "desc")
   *   category?   — "SCALE" | "TEST" | "RISK" | "KILL"
   *   search?     — fuzzy match on title or SKU
   *   cursor?     — cursor-based pagination (product ID)
   *   limit?      — max 200, default 50
   */
  app.get("/products", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();

      const {
        storeId,
        range = "30d",
        sortBy = "score",
        sortDir = "desc",
        category,
        search,
        cursor,
        limit = "50"
      } = request.query as Record<string, string>;

      // --- Resolve store ---
      let resolvedStoreId = storeId;

      if (!resolvedStoreId) {
        const store = await app.prisma.store.findFirst({
          where: { ownerId: payload.sub },
          orderBy: { createdAt: "asc" }
        });
        if (!store) {
          return reply.send({ ok: true, items: [], total: 0, hasMore: false, nextCursor: null });
        }
        resolvedStoreId = store.id;
      } else {
        const store = await app.prisma.store.findFirst({
          where: { id: resolvedStoreId, ownerId: payload.sub }
        });
        if (!store) {
          return reply.code(403).send({ ok: false, message: "Forbidden" });
        }
      }

      // --- Date range for metric lookup ---
      const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
      const since = new Date();
      since.setDate(since.getDate() - days);

      // --- Pagination ---
      const take = Math.min(parseInt(limit, 10) || 50, 200);

      // --- Filter ---
      type CategoryEnum = "SCALE" | "TEST" | "RISK" | "KILL";
      const validCategories: CategoryEnum[] = ["SCALE", "TEST", "RISK", "KILL"];
      const categoryFilter =
        category && validCategories.includes(category as CategoryEnum)
          ? (category as CategoryEnum)
          : undefined;

      const whereClause = {
        storeId: resolvedStoreId,
        ...(categoryFilter && { category: categoryFilter }),
        ...(search?.trim() && {
          OR: [
            { title: { contains: search.trim(), mode: "insensitive" as const } },
            { sku: { contains: search.trim(), mode: "insensitive" as const } }
          ]
        })
      };

      // --- Sort ---
      const sortField = VALID_SORT_FIELDS[sortBy] ?? "score";
      const direction = sortDir === "asc" ? "asc" : "desc";

      // --- Query ---
      const [products, total] = await app.prisma.$transaction([
        app.prisma.productMeta.findMany({
          where: whereClause,
          orderBy: { [sortField]: direction },
          take: take + 1,
          ...(cursor && { cursor: { id: cursor }, skip: 1 }),
          include: {
            dailyMetrics: {
              where: { date: { gte: since } },
              orderBy: { date: "desc" },
              take: 1
            }
          }
        }),
        app.prisma.productMeta.count({ where: whereClause })
      ]);

      const hasMore = products.length > take;
      const items = hasMore ? products.slice(0, take) : products;
      const nextCursor = hasMore ? items[items.length - 1].id : null;

      const formatted = items.map((p) => {
        const m = p.dailyMetrics[0];
        return {
          id: p.id,
          externalId: p.externalId,
          sku: p.sku ?? "",
          title: p.title,
          imageUrl: p.imageUrl ?? null,
          score: p.score,
          category: p.category,
          roas: m?.roas ?? 0,
          blendedRoas: m?.blendedRoas ?? null,
          revenue: m?.revenue ?? 0,
          spend: m?.spend ?? 0,
          margin: m?.margin ?? 0,
          velocity: m?.velocity ?? 0,
          impressions: m?.impressions ?? 0,
          clicks: m?.clicks ?? 0,
          conversions: m?.conversions ?? 0,
          conversionRate: m?.conversionRate ?? 0,
          inventoryLevel: m?.inventoryLevel ?? null,
          updatedAt: p.updatedAt
        };
      });

      return reply.send({
        ok: true,
        storeId: resolvedStoreId,
        range,
        total,
        items: formatted,
        hasMore,
        nextCursor
      });
    } catch (err) {
      app.log.error({ err }, "Products fetch error");
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });

  /**
   * GET /products/:productId
   * Get a single product with full metrics history.
   */
  app.get("/products/:productId", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      const { productId } = request.params as { productId: string };

      const product = await app.prisma.productMeta.findFirst({
        where: { id: productId },
        include: {
          store: { select: { ownerId: true, currency: true } },
          dailyMetrics: {
            orderBy: { date: "desc" },
            take: 90
          }
        }
      });

      if (!product || product.store.ownerId !== payload.sub) {
        return reply.code(404).send({ ok: false, message: "Product not found" });
      }

      return reply.send({ ok: true, product });
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });
}
