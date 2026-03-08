import type { FastifyInstance } from "fastify";

function formatRoas(val: number): string {
  return val > 0 ? `${val.toFixed(1)}x` : "—";
}

function formatCurrency(val: number, currency = "USD"): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}k`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(val);
}

function isValidDate(value?: string) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function parseRange(range?: string, start?: string, end?: string) {
  if (start && end && isValidDate(start) && isValidDate(end)) {
    const s = new Date(start);
    const e = new Date(end);
    if (s <= e) {
      e.setHours(23, 59, 59, 999);
      return { start: s, end: e, range: "custom" };
    }
  }

  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const e = new Date();
  const s = new Date();
  s.setDate(e.getDate() - days + 1);
  e.setHours(23, 59, 59, 999);
  return { start: s, end: e, range: range ?? "30d" };
}

export async function dashboardRoutes(app: FastifyInstance) {
  /**
   * GET /dashboard
   * Returns aggregated stats, top-performing products, and risk products
   * for the authenticated user's active store.
   *
   * Query: { storeId? }  — defaults to user's first store
   */
  app.get("/dashboard", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      const { storeId, range, start, end } = request.query as { storeId?: string; range?: string; start?: string; end?: string };

      // Resolve store
      const storeWhere = storeId
        ? { id: storeId, ownerId: payload.sub }
        : { ownerId: payload.sub };

      const store = await app.prisma.store.findFirst({
        where: storeWhere,
        orderBy: { createdAt: "asc" }
      });

      // No store connected yet — return zeroed-out defaults
      if (!store) {
        return reply.send({
          ok: true,
          storeId: null,
          stats: {
            roas: { value: "—", delta: "No store connected" },
            blendedRoas: { value: "—", delta: "Connect Meta + store to see" },
            activeSKUs: { value: 0, delta: "0 products synced" },
            inventoryRisk: { value: 0, delta: "No catalog data yet" }
          },
          topProducts: [],
          riskProducts: []
        });
      }

      const { start: rangeStart, end: rangeEnd, range: resolvedRange } = parseRange(range, start, end);
      const durationDays = Math.max(
        1,
        Math.floor((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
      );
      const prevEnd = new Date(rangeStart);
      prevEnd.setDate(prevEnd.getDate() - 1);
      prevEnd.setHours(23, 59, 59, 999);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - durationDays + 1);

      const [currentMetrics, prevMetrics, activeSKUs, riskCount, topProducts, riskProducts] =
        await app.prisma.$transaction([
          // Current period aggregates
          app.prisma.dailyMetric.aggregate({
            where: { storeId: store.id, date: { gte: rangeStart, lte: rangeEnd } },
            _sum: { revenue: true, spend: true, impressions: true, clicks: true, conversions: true },
            _avg: { roas: true, blendedRoas: true, ctr: true, margin: true }
          }),

          // Previous period aggregates (for delta %)
          app.prisma.dailyMetric.aggregate({
            where: { storeId: store.id, date: { gte: prevStart, lte: prevEnd } },
            _avg: { roas: true, blendedRoas: true }
          }),

          // Total active products
          app.prisma.productMeta.count({ where: { storeId: store.id } }),

          // Risk/Kill products count
          app.prisma.productMeta.count({
            where: { storeId: store.id, category: { in: ["RISK", "KILL"] } }
          }),

          // Top SCALE products (by score desc)
          app.prisma.productMeta.findMany({
            where: { storeId: store.id, category: "SCALE" },
            orderBy: { score: "desc" },
            take: 6,
            include: {
              dailyMetrics: {
                orderBy: { date: "desc" },
                take: 1
              }
            }
          }),

          // Risk / Kill products (by score asc)
          app.prisma.productMeta.findMany({
            where: { storeId: store.id, category: { in: ["RISK", "KILL"] } },
            orderBy: { score: "asc" },
            take: 6,
            include: {
              dailyMetrics: {
                orderBy: { date: "desc" },
                take: 1
              }
            }
          })
        ]);

      const avgRoas = currentMetrics._avg.roas ?? 0;
      const avgBlendedRoas = currentMetrics._avg.blendedRoas ?? avgRoas;
      const prevAvgRoas = prevMetrics._avg.roas ?? 0;
      const prevBlendedRoas = prevMetrics._avg.blendedRoas ?? prevAvgRoas;

      const totalRevenue = currentMetrics._sum.revenue ?? 0;
      const totalSpend = currentMetrics._sum.spend ?? 0;

      // Compute delta % vs previous period
      const roasDelta = prevAvgRoas > 0
        ? ((avgRoas - prevAvgRoas) / prevAvgRoas) * 100
        : null;
      const blendedDelta = prevBlendedRoas > 0
        ? ((avgBlendedRoas - prevBlendedRoas) / prevBlendedRoas) * 100
        : null;

      const formatDelta = (pct: number | null, fallback: string) => {
        if (pct === null) return fallback;
        const sign = pct >= 0 ? "+" : "";
        return `${sign}${pct.toFixed(1)}% vs last 30d`;
      };

      return reply.send({
        ok: true,
        storeId: store.id,
        storeName: store.name,
        currency: store.currency,
        range: resolvedRange,
        start: rangeStart.toISOString().slice(0, 10),
        end: rangeEnd.toISOString().slice(0, 10),
        stats: {
          roas: {
            value: formatRoas(avgRoas),
            delta: formatDelta(roasDelta, totalSpend > 0 ? `${formatCurrency(totalRevenue, store.currency)} revenue` : "No ad data yet")
          },
          blendedRoas: {
            value: formatRoas(avgBlendedRoas),
            delta: formatDelta(blendedDelta, "All channels combined")
          },
          activeSKUs: {
            value: activeSKUs,
            delta: activeSKUs > 0
              ? `${riskCount} at risk · ${activeSKUs - riskCount} healthy`
              : "No products synced yet"
          },
          inventoryRisk: {
            value: riskCount,
            delta: activeSKUs > 0
              ? `${Math.round((riskCount / activeSKUs) * 100)}% of catalog`
              : "Sync your store to begin"
          }
        },
        topProducts: topProducts.map((p) => {
          const m = p.dailyMetrics[0];
          return {
            id: p.id,
            title: p.title,
            sku: p.sku,
            imageUrl: p.imageUrl,
            score: p.score,
            category: p.category,
            roas: m?.roas ?? 0,
            blendedRoas: m?.blendedRoas ?? null,
            revenue: m?.revenue ?? 0,
            spend: m?.spend ?? 0,
            margin: m?.margin ?? 0
          };
        }),
        riskProducts: riskProducts.map((p) => {
          const m = p.dailyMetrics[0];
          return {
            id: p.id,
            title: p.title,
            sku: p.sku,
            imageUrl: p.imageUrl,
            score: p.score,
            category: p.category,
            roas: m?.roas ?? 0,
            revenue: m?.revenue ?? 0,
            margin: m?.margin ?? 0
          };
        })
      });
    } catch (err) {
      app.log.error({ err }, "Dashboard error");
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });
}
