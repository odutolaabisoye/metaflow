import type { FastifyInstance } from "fastify";

// Fields sorted natively by the DB (indexed columns on ProductMeta)
const DB_SORT_FIELDS = new Set(["score", "title", "updatedAt"]);

// Fields that require in-memory aggregation over the selected date range
const METRIC_SORT_FIELDS = new Set([
  "revenue", "roas", "ctr", "spend", "margin",
  "velocity", "impressions", "clicks", "conversions", "conversionRate"
]);

function isValidDate(value?: string) {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
}

function parseRange(range?: string, start?: string, end?: string) {
  // Frontend always sends computed start/end — use them directly when valid
  if (start && end && isValidDate(start) && isValidDate(end)) {
    const s = new Date(start);
    const e = new Date(end);
    if (s <= e) {
      s.setHours(0, 0, 0, 0);
      e.setHours(23, 59, 59, 999);
      return { start: s, end: e, range: range ?? "custom" };
    }
  }

  // Fallback: derive from range string (used when start/end are absent)
  const now = new Date();
  const e = new Date(now);
  e.setHours(23, 59, 59, 999);

  if (range === "today") {
    const s = new Date(now); s.setHours(0, 0, 0, 0);
    return { start: s, end: e, range: "today" };
  }
  if (range === "yesterday") {
    const s = new Date(now); s.setDate(s.getDate() - 1); s.setHours(0, 0, 0, 0);
    const ye = new Date(s); ye.setHours(23, 59, 59, 999);
    return { start: s, end: ye, range: "yesterday" };
  }
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const s = new Date(now);
  s.setDate(s.getDate() - days + 1);
  s.setHours(0, 0, 0, 0);
  return { start: s, end: e, range: range ?? "30d" };
}

export async function productRoutes(app: FastifyInstance) {
  /**
   * GET /products
   *
   * Returns a paginated, sorted product catalog for the authenticated user's store,
   * joined with aggregated daily metrics over the selected date range.
   *
   * Query params:
   *   storeId?    — defaults to first store
   *   range?      — "today" | "yesterday" | "7d" | "30d" | "90d" (default: "30d")
   *   start?      — ISO date override for range start
   *   end?        — ISO date override for range end
   *   sortBy?     — "score" | "title" | "updatedAt"        (DB sort)
   *               | "revenue" | "roas" | "ctr" | "spend"   (metric sort — in-memory)
   *               | "margin" | "velocity" | "impressions"
   *               | "clicks" | "conversions" | "conversionRate"
   *   sortDir?    — "asc" | "desc" (default: "desc")
   *   category?   — "SCALE" | "TEST" | "RISK" | "KILL"
   *   search?     — fuzzy match on title or SKU
   *   stock?      — "inStock" | "outOfStock" — filter by latest inventoryLevel
   *   page?       — 0-indexed page number (default: 0)
   *   limit?      — max 200, default 50
   */
  app.get("/products", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();

      const {
        storeId,
        range = "30d",
        start,
        end,
        sortBy = "score",
        sortDir = "desc",
        category,
        search,
        stock,
        page = "0",
        limit = "50",
        includeVariants
      } = request.query as Record<string, string>;

      // --- Resolve store ---
      let resolvedStoreId = storeId;
      let storeCurrency: string | null = null;

      if (!resolvedStoreId) {
        const store = await app.prisma.store.findFirst({
          where: { ownerId: payload.sub },
          orderBy: { createdAt: "asc" },
          select: { id: true, currency: true }
        });
        if (!store) {
          return reply.send({ ok: true, items: [], total: 0, page: 0, totalPages: 0 });
        }
        resolvedStoreId = store.id;
        storeCurrency = store.currency ?? null;
      } else {
        const store = await app.prisma.store.findFirst({
          where: { id: resolvedStoreId, ownerId: payload.sub },
          select: { id: true, currency: true }
        });
        if (!store) return reply.code(403).send({ ok: false, message: "Forbidden" });
        storeCurrency = store.currency ?? null;
      }

      // --- Date range ---
      const { start: since, end: until, range: resolvedRange } = parseRange(range, start, end);

      // --- Pagination params ---
      const take    = Math.min(parseInt(limit, 10) || 50, 200);
      const pageNum = Math.max(0, parseInt(page, 10) || 0);

      // --- Category filter ---
      type CategoryEnum = "SCALE" | "TEST" | "RISK" | "KILL";
      const validCategories: CategoryEnum[] = ["SCALE", "TEST", "RISK", "KILL"];
      const categoryFilter =
        category && validCategories.includes(category as CategoryEnum)
          ? (category as CategoryEnum)
          : undefined;

      const whereClause = {
        storeId: resolvedStoreId,
        ...(includeVariants !== "true" ? { isVariant: false } : {}),
        ...(categoryFilter && { category: categoryFilter }),
        ...(search?.trim() && {
          OR: [
            { title: { contains: search.trim(), mode: "insensitive" as const } },
            { sku:   { contains: search.trim(), mode: "insensitive" as const } }
          ]
        })
      };

      const direction      = sortDir === "asc" ? "asc" : "desc";
      const isMetricSort   = METRIC_SORT_FIELDS.has(sortBy);

      let productIds: string[];
      let total: number;

      if (isMetricSort) {
        // ── Metric sort: fetch ALL matching IDs, aggregate, sort in-memory, paginate ──

        // 1. Get all matching product IDs (no sort needed at DB level)
        const allProds = await app.prisma.productMeta.findMany({
          where: whereClause,
          select: { id: true }
        });
        total = allProds.length;
        const allIds = allProds.map(p => p.id);

        if (allIds.length === 0) {
          productIds = [];
        } else {
          // If we're showing parents only, include their variants in aggregation
          let variantMap = new Map<string, string[]>();
          let aggIds = allIds;
          if (includeVariants !== "true") {
            const variants = await app.prisma.productMeta.findMany({
              where: { parentId: { in: allIds } },
              select: { id: true, parentId: true }
            });
            for (const v of variants) {
              if (!v.parentId) continue;
              const list = variantMap.get(v.parentId) ?? [];
              list.push(v.id);
              variantMap.set(v.parentId, list);
            }
            aggIds = [...allIds, ...variants.map(v => v.id)];
          }

          // 2. Aggregate ALL metrics for all matching products in the date range
          const aggAll = await app.prisma.dailyMetric.groupBy({
            by: ["productId"],
            where: {
              storeId: resolvedStoreId,
              productId: { in: aggIds },
              date: { gte: since, lte: until }
            },
            _sum: { revenue: true, metaRevenue: true, spend: true, impressions: true, clicks: true, conversions: true },
            _avg: { margin: true, velocity: true }
          });

          // Build a complete metric map (products with no metrics get 0s)
          const metricMap = new Map(aggAll.map(m => {
            const metaRev = m._sum.metaRevenue ?? 0;
            const rev = m._sum.revenue    ?? 0;
            const spd = m._sum.spend      ?? 0;
            const imp = m._sum.impressions ?? 0;
            const clk = m._sum.clicks     ?? 0;
            const cvt = m._sum.conversions ?? 0;
            return [m.productId, {
              revenue:        rev,
              metaRevenue:    metaRev,
              spend:          spd,
              impressions:    imp,
              clicks:         clk,
              conversions:    cvt,
              roas:           spd > 0 ? metaRev / spd : 0,
              ctr:            imp > 0 ? clk / imp : 0,
              conversionRate: clk > 0 ? cvt / clk : 0,
              margin:         m._avg.margin   ?? 0,
              velocity:       m._avg.velocity ?? 0
            }];
          }));

          // Roll up variants into parents when needed
          const rollupMap = new Map<string, Record<string, number>>();
          if (includeVariants !== "true") {
            for (const parentId of allIds) {
              const base = metricMap.get(parentId) ?? {
                revenue: 0, metaRevenue: 0, spend: 0, impressions: 0, clicks: 0, conversions: 0,
                roas: 0, ctr: 0, conversionRate: 0, margin: 0, velocity: 0
              };
              const variants = variantMap.get(parentId) ?? [];
              let revenue = base.revenue;
              let metaRevenue = base.metaRevenue;
              let spend = base.spend;
              let impressions = base.impressions;
              let clicks = base.clicks;
              let conversions = base.conversions;
              let marginSum = base.margin;
              let marginCount = base.margin > 0 ? 1 : 0;
              let velocitySum = base.velocity;
              let velocityCount = base.velocity > 0 ? 1 : 0;
              for (const vid of variants) {
                const mv = metricMap.get(vid);
                if (!mv) continue;
                revenue += mv.revenue;
                metaRevenue += mv.metaRevenue;
                spend += mv.spend;
                impressions += mv.impressions;
                clicks += mv.clicks;
                conversions += mv.conversions;
                if (mv.margin > 0) { marginSum += mv.margin; marginCount += 1; }
                if (mv.velocity > 0) { velocitySum += mv.velocity; velocityCount += 1; }
              }
              rollupMap.set(parentId, {
                revenue,
                metaRevenue,
                spend,
                impressions,
                clicks,
                conversions,
                roas: spend > 0 ? metaRevenue / spend : 0,
                ctr: impressions > 0 ? clicks / impressions : 0,
                conversionRate: clicks > 0 ? conversions / clicks : 0,
                margin: marginCount > 0 ? marginSum / marginCount : 0,
                velocity: velocityCount > 0 ? velocitySum / velocityCount : 0
              });
            }
          }

          // 3. Sort all IDs in-memory by the requested metric
          const sorted = [...allIds].sort((a, b) => {
            const source = includeVariants !== "true" ? rollupMap : metricMap;
            const va = (source.get(a) as Record<string, number> | undefined)?.[sortBy] ?? 0;
            const vb = (source.get(b) as Record<string, number> | undefined)?.[sortBy] ?? 0;
            return direction === "desc" ? vb - va : va - vb;
          });

          // 4. Slice for the requested page
          productIds = sorted.slice(pageNum * take, (pageNum + 1) * take);
        }

      } else {
        // ── DB sort: standard OFFSET pagination via Prisma skip ──

        const dbSortField = DB_SORT_FIELDS.has(sortBy) ? sortBy : "score";
        const orderBy = [
          { [dbSortField]: direction as "asc" | "desc" },
          { id: direction as "asc" | "desc" }
        ];

        const [dbProds, dbTotal] = await app.prisma.$transaction([
          app.prisma.productMeta.findMany({
            where: whereClause,
            orderBy,
            skip: pageNum * take,
            take,
            select: { id: true }
          }),
          app.prisma.productMeta.count({ where: whereClause })
        ]);

        total      = dbTotal;
        productIds = dbProds.map(p => p.id);
      }

      const totalPages = total > 0 ? Math.ceil(total / take) : 0;

      // --- Helpers for early-empty returns ---
      const metaCurrencyQ    = (request.query as Record<string, string>).metaCurrency;
      const safeMetaCurrency =
        typeof metaCurrencyQ === "string" && /^[A-Z]{3}$/.test(metaCurrencyQ)
          ? metaCurrencyQ
          : undefined;
      const currency       = safeMetaCurrency ?? storeCurrency ?? "USD";
      const currencySource = safeMetaCurrency ? "meta_ads" : storeCurrency ? "store" : "default";

      if (productIds.length === 0) {
        return reply.send({
          ok: true,
          storeId: resolvedStoreId,
          range: resolvedRange,
          start: since.toISOString().slice(0, 10),
          end:   until.toISOString().slice(0, 10),
          currency,
          currencySource,
          total,
          page: pageNum,
          totalPages,
          items: []
        });
      }

      // --- Fetch full product data + metrics for the current page ---
      const variants = includeVariants !== "true"
        ? await app.prisma.productMeta.findMany({
            where: { parentId: { in: productIds } },
            select: { id: true, parentId: true }
          })
        : [];

      const aggIds = includeVariants !== "true"
        ? [...productIds, ...variants.map(v => v.id)]
        : productIds;

      const [pageProducts, metricsAgg, latestSnapshots] = await Promise.all([
        app.prisma.productMeta.findMany({
          where: { id: { in: productIds } }
        }),
        // Aggregate metrics across the full selected date range for this page
        app.prisma.dailyMetric.groupBy({
          by: ["productId"],
          where: {
            storeId: resolvedStoreId,
            productId: { in: aggIds },
            date: { gte: since, lte: until }
          },
          _sum: {
            revenue:     true,
            metaRevenue: true,
            spend:       true,
            impressions: true,
            clicks:      true,
            conversions: true
          },
          _avg: {
            margin:      true,
            velocity:    true,
            blendedRoas: true
          }
        }),
        // Latest metric snapshot for non-aggregatable fields (inventoryLevel, blendedRoas)
        app.prisma.dailyMetric.findMany({
          where: { storeId: resolvedStoreId, productId: { in: aggIds } },
          orderBy: { date: "desc" },
          distinct: ["productId"],
          select: { productId: true, inventoryLevel: true, blendedRoas: true }
        })
      ]);

      const productMap = new Map(pageProducts.map(p => [p.id, p]));
      const aggMap     = new Map(metricsAgg.map(m => [m.productId, m]));
      const snapMap    = new Map(latestSnapshots.map(m => [m.productId, m]));
      const variantMap = new Map<string, string[]>();
      for (const v of variants) {
        if (!v.parentId) continue;
        const list = variantMap.get(v.parentId) ?? [];
        list.push(v.id);
        variantMap.set(v.parentId, list);
      }

      // Iterate productIds (not pageProducts) to preserve sort order
      const formatted = productIds.flatMap((id) => {
        const p = productMap.get(id);
        if (!p) return [];
        const agg  = aggMap.get(id);
        const snap = snapMap.get(id);
        const variantIds = includeVariants !== "true" ? (variantMap.get(id) ?? []) : [];

        let imp     = agg?._sum.impressions  ?? 0;
        let clk     = agg?._sum.clicks       ?? 0;
        let cvt     = agg?._sum.conversions  ?? 0;
        let rev     = agg?._sum.revenue      ?? 0;   // total store revenue
        let metaRev = agg?._sum.metaRevenue  ?? 0;   // Meta-attributed purchase value
        let spd     = agg?._sum.spend        ?? 0;
        let marginSum = agg?._avg.margin ?? 0;
        let marginCount = agg?._avg.margin ? 1 : 0;
        let velocitySum = agg?._avg.velocity ?? 0;
        let velocityCount = agg?._avg.velocity ? 1 : 0;

        if (variantIds.length > 0) {
          for (const vid of variantIds) {
            const vAgg = aggMap.get(vid);
            if (!vAgg) continue;
            imp     += vAgg._sum.impressions  ?? 0;
            clk     += vAgg._sum.clicks       ?? 0;
            cvt     += vAgg._sum.conversions  ?? 0;
            rev     += vAgg._sum.revenue      ?? 0;
            metaRev += vAgg._sum.metaRevenue  ?? 0;
            spd     += vAgg._sum.spend        ?? 0;
            if (vAgg._avg.margin)   { marginSum += vAgg._avg.margin;   marginCount += 1; }
            if (vAgg._avg.velocity) { velocitySum += vAgg._avg.velocity; velocityCount += 1; }
          }
        }

        return [{
          id:             p.id,
          externalId:     p.externalId,
          sku:            p.sku ?? "",
          title:          p.title,
          imageUrl:       p.imageUrl ?? null,
          productUrl:     p.productUrl ?? null,
          score:          p.score,
          category:       p.category,
          // Meta ROAS = Meta-attributed purchase value / Meta ad spend
          // (store revenue / Meta spend gives "blended" ROAS, not Meta ROAS)
          roas:           spd > 0 ? metaRev / spd : 0,
          // Blended ROAS = total store revenue / Meta spend; fall back to snapshot
          blendedRoas:    spd > 0 ? (rev > 0 ? rev / spd : metaRev / spd) : (snap?.blendedRoas ?? null),
          ctr:            imp > 0 ? clk / imp : 0,
          revenue:        rev,
          metaRevenue:    metaRev,
          spend:          spd,
          margin:         marginCount > 0 ? marginSum / marginCount : 0,
          velocity:       velocityCount > 0 ? velocitySum / velocityCount : 0,
          impressions:    imp,
          clicks:         clk,
          conversions:    cvt,
          conversionRate: clk > 0 ? cvt / clk : 0,
          inventoryLevel: snap?.inventoryLevel ?? null,
          updatedAt:      p.updatedAt
        }];
      });

      return reply.send({
        ok: true,
        storeId: resolvedStoreId,
        range: resolvedRange,
        start: since.toISOString().slice(0, 10),
        end:   until.toISOString().slice(0, 10),
        currency,
        currencySource,
        total,
        page: pageNum,
        totalPages,
        items: formatted
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

  /**
   * POST /products/notify-export
   * Called by the frontend after a CSV export download completes.
   * Sends the user an email confirming the export and how many products were included.
   *
   * Body: { productCount: number }
   */
  app.post("/products/notify-export", async (request, reply) => {
    let payload: { sub: string };
    try {
      payload = await request.jwtVerify<{ sub: string }>();
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }

    const { productCount = 0 } = (request.body as { productCount?: number }) ?? {};

    const user = await app.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { email: true, name: true }
    });

    if (user) {
      app.mail.sendExportReady(user.email, user.name ?? "", productCount).catch((err) =>
        app.log.error({ err }, "Failed to send export email")
      );
    }

    return reply.send({ ok: true });
  });
}
