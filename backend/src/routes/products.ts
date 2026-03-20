import type { FastifyInstance } from "fastify";
import { storeLocalDayBounds, storeLocalDateStr } from "../jobs/dateUtils.js";

// Fields sorted natively by the DB (indexed columns on ProductMeta)
const DB_SORT_FIELDS = new Set(["score", "title", "updatedAt"]);

// Fields that require in-memory aggregation over the selected date range
const METRIC_SORT_FIELDS = new Set([
  "revenue", "roas", "ctr", "spend", "margin",
  "velocity", "impressions", "clicks", "conversions", "conversionRate",
  "addToCart", "checkoutInitiated",
]);

// Fields that can be sorted using pre-computed 30d columns on ProductMeta (DB sort — fast)
const PRECOMPUTED_SORT_FIELDS = new Map([
  ["spend",       "spend30d"],
  ["revenue",     "revenue30d"],
  ["metaRevenue", "metaRevenue30d"],
  ["impressions", "impressions30d"],
  ["clicks",      "clicks30d"],
  ["conversions", "conversions30d"],
  ["roas",        "roas30d"],
  ["ctr",         "ctr30d"],
  ["addToCart",          "addToCartOmni30d"],
  ["checkoutInitiated",  "checkoutInitiatedOmni30d"],
]);

// Same map for 7d — used when resolvedRange === "7d"
const PRECOMPUTED_SORT_FIELDS_7D = new Map([
  ["spend",       "spend7d"],
  ["revenue",     "revenue7d"],
  ["metaRevenue", "metaRevenue7d"],
  ["impressions", "impressions7d"],
  ["clicks",      "clicks7d"],
  ["conversions", "conversions7d"],
  ["roas",        "roas7d"],
  ["ctr",         "ctr7d"],
  ["addToCart",          "addToCartOmni7d"],
  ["checkoutInitiated",  "checkoutInitiatedOmni7d"],
]);

function isValidDate(value?: string) {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
}

function parseRange(range?: string, start?: string, end?: string, timezone = "Africa/Lagos") {
  const now = new Date();

  // Frontend always sends computed start/end as "YYYY-MM-DD" local date strings.
  // Convert them to UTC timestamps using the store's actual timezone so that
  // "2026-03-20" means midnight-to-midnight in the store's local time, not UTC.
  if (start && end && isValidDate(start) && isValidDate(end)) {
    const sDay = storeLocalDayBounds(timezone, new Date(`${start}T12:00:00Z`)); // noon avoids DST edge
    const eDay = storeLocalDayBounds(timezone, new Date(`${end}T12:00:00Z`));
    if (sDay.start <= eDay.end) {
      return { start: sDay.start, end: eDay.end, range: range ?? "custom" };
    }
  }

  // Fallback: derive from range string using the store's timezone
  const { start: todayStart, end: todayEnd } = storeLocalDayBounds(timezone, now);

  if (range === "today") {
    return { start: todayStart, end: todayEnd, range: "today" };
  }
  if (range === "yesterday") {
    const yest = new Date(now.getTime() - 86_400_000);
    const { start: ys, end: ye } = storeLocalDayBounds(timezone, yest);
    return { start: ys, end: ye, range: "yesterday" };
  }
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const pastDay = new Date(now.getTime() - (days - 1) * 86_400_000);
  const { start: ps } = storeLocalDayBounds(timezone, pastDay);
  return { start: ps, end: todayEnd, range: range ?? "30d" };
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
      let storeTimezone = "Africa/Lagos";
      let storeLastSyncAt: Date | null = null;
      let storeLastSyncStatus = "IDLE";
      let storeLastSyncError: string | null = null;

      const STORE_SELECT = { id: true, currency: true, timezone: true, lastSyncAt: true, lastSyncStatus: true, lastSyncError: true } as const;

      if (!resolvedStoreId) {
        const store = await app.prisma.store.findFirst({
          where: { ownerId: payload.sub },
          orderBy: { createdAt: "asc" },
          select: STORE_SELECT,
        });
        if (!store) {
          return reply.send({ ok: true, items: [], total: 0, page: 0, totalPages: 0 });
        }
        resolvedStoreId = store.id;
        storeCurrency = store.currency ?? null;
        storeTimezone = store.timezone ?? "Africa/Lagos";
        storeLastSyncAt = store.lastSyncAt ?? null;
        storeLastSyncStatus = store.lastSyncStatus ?? "IDLE";
        storeLastSyncError = store.lastSyncError ?? null;
      } else {
        const store = await app.prisma.store.findFirst({
          where: { id: resolvedStoreId, ownerId: payload.sub },
          select: STORE_SELECT,
        });
        if (!store) return reply.code(403).send({ ok: false, message: "Forbidden" });
        storeCurrency = store.currency ?? null;
        storeTimezone = store.timezone ?? "Africa/Lagos";
        storeLastSyncAt = store.lastSyncAt ?? null;
        storeLastSyncStatus = store.lastSyncStatus ?? "IDLE";
        storeLastSyncError = store.lastSyncError ?? null;
      }

      // --- Date range (uses store's own timezone, not server OS timezone) ---
      const { start: since, end: until, range: resolvedRange } = parseRange(range, start, end, storeTimezone);

      // --- Pagination params ---
      const take    = Math.min(parseInt(limit, 10) || 50, 200);
      const pageNum = Math.max(0, parseInt(page, 10) || 0);

      // For 30d/7d ranges, use pre-computed ProductMeta columns instead of DailyMetric aggregation
      const precomputedSortField =
        resolvedRange === "30d" ? PRECOMPUTED_SORT_FIELDS.get(sortBy) :
        resolvedRange === "7d"  ? PRECOMPUTED_SORT_FIELDS_7D.get(sortBy) :
        undefined;
      const use30dFastSort = !!precomputedSortField;

      // --- Category filter ---
      type CategoryEnum = "SCALE" | "TEST" | "RISK" | "KILL";
      const validCategories: CategoryEnum[] = ["SCALE", "TEST", "RISK", "KILL"];
      const categoryFilter =
        category && validCategories.includes(category as CategoryEnum)
          ? (category as CategoryEnum)
          : undefined;

      // Stock filter — applied to ProductMeta.inventoryLevel (latest synced value)
      const stockWhere =
        stock === "inStock"    ? { inventoryLevel: { gt: 0 } } :
        stock === "outOfStock" ? { OR: [{ inventoryLevel: { equals: 0 } }, { inventoryLevel: null }] } :
        undefined;

      const whereClause = {
        storeId: resolvedStoreId,
        ...(categoryFilter && { category: categoryFilter }),
        ...(stockWhere),
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

      if (isMetricSort && use30dFastSort) {
        // ── Fast path: 30d/7d range — sort by pre-computed indexed column on ProductMeta ──
        // This is an indexed DB-level sort, equivalent to the DB_SORT_FIELDS path.
        const precomputedField = precomputedSortField!;
        const orderBy = [
          { [precomputedField]: direction as "asc" | "desc" },
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

      } else if (isMetricSort) {
        // ── Metric sort (non-30d): fetch ALL matching IDs, aggregate, sort in-memory, paginate ──

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
          // 2. Aggregate ALL metrics for all matching products in the date range
          const aggAll = await app.prisma.dailyMetric.groupBy({
            by: ["productId"],
            where: {
              storeId: resolvedStoreId,
              productId: { in: allIds },
              date: { gte: since, lte: until }
            },
            _sum: {
              revenue: true, metaRevenue: true, spend: true,
              impressions: true, clicks: true, conversions: true,
              addToCart: true, addToCartOmni: true,
              checkoutInitiated: true, checkoutInitiatedOmni: true,
            },
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
              velocity:       m._avg.velocity ?? 0,
              addToCart:      m._sum.addToCartOmni        ?? 0,
              checkoutInitiated: m._sum.checkoutInitiatedOmni ?? 0,
            }];
          }));

          // 3. Sort all IDs in-memory by the requested metric
          const sorted = [...allIds].sort((a, b) => {
            const va = (metricMap.get(a) as Record<string, number> | undefined)?.[sortBy] ?? 0;
            const vb = (metricMap.get(b) as Record<string, number> | undefined)?.[sortBy] ?? 0;
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
      const [pageProducts, metricsAgg, latestSnapshots] = await Promise.all([
        app.prisma.productMeta.findMany({
          where: { id: { in: productIds } }
        }),
        // Aggregate metrics across the full selected date range for this page
        app.prisma.dailyMetric.groupBy({
          by: ["productId"],
          where: {
            storeId: resolvedStoreId,
            productId: { in: productIds },
            date: { gte: since, lte: until }
          },
          _sum: {
            revenue:     true,
            metaRevenue: true,
            spend:       true,
            impressions: true,
            clicks:      true,
            conversions: true,
            addToCart:             true,
            addToCartOmni:         true,
            checkoutInitiated:     true,
            checkoutInitiatedOmni: true,
          },
          _avg: {
            margin:      true,
            velocity:    true,
            blendedRoas: true
          }
        }),
        // Latest metric snapshot for non-aggregatable fields (inventoryLevel, blendedRoas)
        app.prisma.dailyMetric.findMany({
          where: { storeId: resolvedStoreId, productId: { in: productIds } },
          orderBy: { date: "desc" },
          distinct: ["productId"],
          select: { productId: true, inventoryLevel: true, blendedRoas: true }
        })
      ]);

      const productMap = new Map(pageProducts.map(p => [p.id, p]));
      const aggMap     = new Map(metricsAgg.map(m => [m.productId, m]));
      const snapMap    = new Map(latestSnapshots.map(m => [m.productId, m]));

      // Iterate productIds (not pageProducts) to preserve sort order
      const formatted = productIds.flatMap((id) => {
        const p = productMap.get(id);
        if (!p) return [];
        const agg  = aggMap.get(id);
        const snap = snapMap.get(id);

        const imp     = agg?._sum.impressions  ?? 0;
        const clk     = agg?._sum.clicks       ?? 0;
        const cvt     = agg?._sum.conversions  ?? 0;
        const rev     = agg?._sum.revenue      ?? 0;
        const metaRev = agg?._sum.metaRevenue  ?? 0;
        const spd     = agg?._sum.spend        ?? 0;
        const marginSum = agg?._avg.margin ?? 0;
        const marginCount = agg?._avg.margin ? 1 : 0;
        const velocitySum = agg?._avg.velocity ?? 0;
        const velocityCount = agg?._avg.velocity ? 1 : 0;

        return [{
          id:             p.id,
          externalId:     p.externalId,
          sku:            p.sku ?? "",
          title:          p.title,
          imageUrl:       p.imageUrl ?? null,
          productUrl:     p.productUrl ?? null,
          variantCount:   p.altIds?.length ?? 0,
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
          // Use null (not 0) when the DailyMetric rows pre-date the ATC migration
          // so the frontend can distinguish "no data yet" from a genuine zero
          addToCart:             agg?._sum.addToCart             ?? null,
          addToCartOmni:         agg?._sum.addToCartOmni         ?? null,
          checkoutInitiated:     agg?._sum.checkoutInitiated     ?? null,
          checkoutInitiatedOmni: agg?._sum.checkoutInitiatedOmni ?? null,
          inventoryLevel: snap?.inventoryLevel ?? null,
          updatedAt:      p.updatedAt
        }];
      });

      // Get latest metricsComputedAt across current page to show freshness indicator
      const latestComputedAt = await app.prisma.productMeta.findFirst({
        where: { id: { in: productIds } },
        orderBy: { metricsComputedAt: "desc" },
        select: { metricsComputedAt: true }
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
        items: formatted,
        store: {
          lastSyncAt:     storeLastSyncAt?.toISOString() ?? null,
          lastSyncStatus: storeLastSyncStatus,
          lastSyncError:  storeLastSyncError,
          lastScoredAt:   latestComputedAt?.metricsComputedAt?.toISOString() ?? null,
        }
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
