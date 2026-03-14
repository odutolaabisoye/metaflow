import type { FastifyInstance } from "fastify";

function formatRoas(val: number): string {
  return val > 0 ? `${val.toFixed(1)}x` : "—";
}

const CURRENCY_LOCALE: Record<string, string> = {
  NGN: "en-NG", GBP: "en-GB", EUR: "de-DE", JPY: "ja-JP",
  AUD: "en-AU", CAD: "en-CA", INR: "en-IN", ZAR: "en-ZA",
  GHS: "en-GH", KES: "sw-KE",
};

function formatCurrency(val: number, currency = "USD"): string {
  const locale = CURRENCY_LOCALE[currency] ?? "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1
    }).format(val);
  } catch {
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1
    }).format(val);
  }
}

function fmtPct(val: number | null | undefined, decimals = 2): string {
  if (val == null) return "--";
  return `${(val * 100).toFixed(decimals)}%`;
}

function isValidDate(value?: string) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
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
          // Current period aggregates — use _sum for all rate-derived metrics
          app.prisma.dailyMetric.aggregate({
            where: { storeId: store.id, date: { gte: rangeStart, lte: rangeEnd } },
            _sum: { revenue: true, metaRevenue: true, spend: true, impressions: true, clicks: true, conversions: true }
          }),

          // Previous period aggregates — sum-based for accurate delta
          app.prisma.dailyMetric.aggregate({
            where: { storeId: store.id, date: { gte: prevStart, lte: prevEnd } },
            _sum: { revenue: true, spend: true }
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

      // ── Extra queries outside the transaction (groupBy not supported in array transactions) ──
      const [dailyRevenue, productRevenueInRange, allProductCats] = await Promise.all([
        // Daily store revenue totals for the trend chart
        app.prisma.dailyMetric.groupBy({
          by: ["date"],
          where: { storeId: store.id, date: { gte: rangeStart, lte: rangeEnd } },
          _sum: { revenue: true },
          orderBy: { date: "asc" }
        }),
        // Per-product revenue in range — used to determine top category by revenue
        app.prisma.dailyMetric.groupBy({
          by: ["productId"],
          where: { storeId: store.id, date: { gte: rangeStart, lte: rangeEnd } },
          _sum: { revenue: true }
        }),
        // All product categories for the store (lightweight: id + category only)
        app.prisma.productMeta.findMany({
          where: { storeId: store.id },
          select: { id: true, category: true }
        })
      ]);

      const totalRevenue     = currentMetrics._sum.revenue     ?? 0;
      const totalSpend       = currentMetrics._sum.spend       ?? 0;
      const totalImpressions = currentMetrics._sum.impressions ?? 0;
      const totalClicks      = currentMetrics._sum.clicks      ?? 0;
      const totalConversions = currentMetrics._sum.conversions ?? 0;

      // Derive rates from totals — averaging daily rates is mathematically incorrect
      const avgRoas        = totalSpend > 0 ? totalRevenue / totalSpend : 0;
      const avgBlendedRoas = avgRoas; // same numerator/denominator (all-channel)
      const avgCtrVal      = totalImpressions > 0 ? totalClicks / totalImpressions : null;
      const avgConvRateVal = totalClicks > 0 ? totalConversions / totalClicks : null;

      // Previous period — also sum-based
      const prevTotalRevenue = prevMetrics._sum.revenue ?? 0;
      const prevTotalSpend   = prevMetrics._sum.spend   ?? 0;
      const prevAvgRoas      = prevTotalSpend > 0 ? prevTotalRevenue / prevTotalSpend : 0;
      const prevBlendedRoas  = prevAvgRoas;

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

      // ── Trend chart data ────────────────────────────────────────────────────
      const revenueValues = dailyRevenue.map(d => d._sum.revenue ?? 0);
      const maxRev = Math.max(...revenueValues, 1);
      const cur = store.currency ?? "USD";

      // Use timeZone:"UTC" so the stored UTC-midnight date is displayed correctly
      // regardless of server timezone — avoids off-by-one on negative UTC offsets
      const fmtDate = (date: Date) =>
        date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

      const trendSeries = dailyRevenue.map(d => {
        const rev = d._sum.revenue ?? 0;
        return {
          value: Math.max(4, Math.round((rev / maxRev) * 100)), // min 4% so bars are visible
          label: `${fmtDate(d.date)}: ${formatCurrency(rev, cur)}`
        };
      });

      // Sample up to 5 evenly-spaced X-axis labels
      const LABEL_COUNT = 5;
      const trendLabels: string[] = dailyRevenue.length === 0 ? [] : (() => {
        const n = Math.min(LABEL_COUNT, dailyRevenue.length);
        return Array.from({ length: n }, (_, i) => {
          const idx = Math.round((i / Math.max(n - 1, 1)) * (dailyRevenue.length - 1));
          return fmtDate(dailyRevenue[idx].date);
        });
      })();

      // ── Attribution row ─────────────────────────────────────────────────────
      // Top category: by revenue in the selected range (not product count)
      const catLookup = new Map(allProductCats.map(p => [p.id, p.category]));
      const catRevMap = new Map<string, number>();
      for (const r of productRevenueInRange) {
        const cat = catLookup.get(r.productId);
        if (cat) catRevMap.set(cat, (catRevMap.get(cat) ?? 0) + (r._sum.revenue ?? 0));
      }
      const topCategory =
        [...catRevMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "--";

      // CTR and conv rate derived from totals — not averages of daily rates
      const avgCtr      = avgCtrVal;
      const avgConvRate = avgConvRateVal;

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
        trend: {
          series: trendSeries,
          labels: trendLabels
        },
        attribution: {
          topCategory,
          avgCtr: fmtPct(avgCtr),
          conversionRate: fmtPct(avgConvRate)
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
            metaRevenue: m?.metaRevenue ?? 0,
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
            metaRevenue: m?.metaRevenue ?? 0,
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
