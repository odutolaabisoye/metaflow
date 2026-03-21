import type { FastifyInstance } from "fastify";
import { storeLocalDayBounds } from "../jobs/dateUtils.js";

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

function parseRange(range?: string, start?: string, end?: string, timezone = "Africa/Lagos") {
  const now = new Date();
  if (start && end && isValidDate(start) && isValidDate(end)) {
    const sDay = storeLocalDayBounds(timezone, new Date(`${start}T12:00:00Z`));
    const eDay = storeLocalDayBounds(timezone, new Date(`${end}T12:00:00Z`));
    if (sDay.start <= eDay.end) return { start: sDay.start, end: eDay.end, range: range ?? "custom" };
  }
  const { start: todayStart, end: todayEnd } = storeLocalDayBounds(timezone, now);
  if (range === "today") return { start: todayStart, end: todayEnd, range: "today" };
  if (range === "yesterday") {
    const { start: ys, end: ye } = storeLocalDayBounds(timezone, new Date(now.getTime() - 86_400_000));
    return { start: ys, end: ye, range: "yesterday" };
  }
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const { start: ps } = storeLocalDayBounds(timezone, new Date(now.getTime() - (days - 1) * 86_400_000));
  return { start: ps, end: todayEnd, range: range ?? "30d" };
}

export async function dashboardRoutes(app: FastifyInstance) {
  /**
   * GET /dashboard
   * Returns aggregated stats, top-performing products, and risk products
   * for the authenticated user's active store.
   *
   * For the default 30d range, KPIs are derived from pre-computed ProductMeta
   * fields written by the scoring job — no DailyMetric aggregation needed.
   * Other ranges fall back to DailyMetric aggregation.
   */
  app.get("/dashboard", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      if (!payload?.sub) return reply.code(401).send({ ok: false, message: "Unauthorized" });
      const { storeId, range, start, end } = request.query as { storeId?: string; range?: string; start?: string; end?: string };

      const storeWhere = storeId
        ? { id: storeId, ownerId: payload.sub }
        : { ownerId: payload.sub };

      const store = await app.prisma.store.findFirst({
        where: storeWhere,
        orderBy: { createdAt: "asc" },
        select: {
          id: true, name: true, platform: true, currency: true,
          timezone: true, lastSyncAt: true, lastSyncStatus: true
        }
      });

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

      const storeTimezone = store.timezone ?? "Africa/Lagos";
      const { start: rangeStart, end: rangeEnd, range: resolvedRange } = parseRange(range, start, end, storeTimezone);
      const usePrecomputed = resolvedRange === "30d" && !start && !end;

      const durationDays = Math.max(
        1,
        Math.floor((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
      );
      const prevEnd = new Date(rangeStart);
      prevEnd.setDate(prevEnd.getDate() - 1);
      prevEnd.setHours(23, 59, 59, 999);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - durationDays + 1);

      const cur = store.currency ?? "USD";
      const fmtDate = (date: Date) =>
        date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

      // ── Top / risk products — read directly from ProductMeta pre-computed fields ──
      // No DailyMetric include needed — scoring job stores roas30d, spend30d etc.
      const [activeSKUs, riskCount, topProducts, riskProducts] = await Promise.all([
        app.prisma.productMeta.count({ where: { storeId: store.id, isVariant: false, isActive: true } }),
        app.prisma.productMeta.count({
          where: { storeId: store.id, isVariant: false, isActive: true, category: { in: ["RISK", "KILL"] } }
        }),
        app.prisma.productMeta.findMany({
          where: { storeId: store.id, isVariant: false, isActive: true, category: "SCALE" },
          orderBy: { score: "desc" },
          take: 6,
          select: {
            id: true, title: true, sku: true, imageUrl: true, score: true, category: true,
            roas30d: true, spend30d: true, revenue30d: true, metaRevenue30d: true, margin: true,
          }
        }),
        app.prisma.productMeta.findMany({
          where: { storeId: store.id, isVariant: false, isActive: true, category: { in: ["RISK", "KILL"] } },
          orderBy: { score: "asc" },
          take: 6,
          select: {
            id: true, title: true, sku: true, imageUrl: true, score: true, category: true,
            roas30d: true, revenue30d: true, metaRevenue30d: true, margin: true,
          }
        })
      ]);

      // ── Trend chart — always needs per-day DailyMetric rows ──
      const dailyRevenue = await app.prisma.dailyMetric.groupBy({
        by: ["date"],
        where: { storeId: store.id, date: { gte: rangeStart, lte: rangeEnd } },
        _sum: { revenue: true },
        orderBy: { date: "asc" }
      });

      let totalRevenue = 0, totalSpend = 0, totalMetaRevenue = 0;
      let totalImpressions = 0, totalClicks = 0, totalConversions = 0;
      let prevTotalRevenue = 0, prevTotalSpend = 0, prevTotalMetaRevenue = 0;

      if (usePrecomputed) {
        // ── Fast path: KPIs from pre-computed ProductMeta fields (no DailyMetric scan) ──
        const agg = await app.prisma.productMeta.aggregate({
          where: { storeId: store.id, isVariant: false, isActive: true },
          _sum: {
            spend30d: true, revenue30d: true, metaRevenue30d: true,
            impressions30d: true, clicks30d: true, conversions30d: true,
          }
        });
        totalSpend       = agg._sum.spend30d       ?? 0;
        totalRevenue     = agg._sum.revenue30d     ?? 0;
        totalMetaRevenue = agg._sum.metaRevenue30d ?? 0;
        totalImpressions = agg._sum.impressions30d ?? 0;
        totalClicks      = agg._sum.clicks30d      ?? 0;
        totalConversions = agg._sum.conversions30d ?? 0;

        // Previous period still needs DailyMetric (pre-computed covers current 30d only)
        const prevMetrics = await app.prisma.dailyMetric.aggregate({
          where: { storeId: store.id, date: { gte: prevStart, lte: prevEnd } },
          _sum: { revenue: true, spend: true, metaRevenue: true }
        });
        prevTotalRevenue     = prevMetrics._sum.revenue     ?? 0;
        prevTotalSpend       = prevMetrics._sum.spend       ?? 0;
        prevTotalMetaRevenue = prevMetrics._sum.metaRevenue ?? 0;
      } else {
        // ── Fallback: aggregate DailyMetric for custom / 7d / 90d ranges ──
        const [currentMetrics, prevMetrics] = await Promise.all([
          app.prisma.dailyMetric.aggregate({
            where: { storeId: store.id, date: { gte: rangeStart, lte: rangeEnd } },
            _sum: { revenue: true, metaRevenue: true, spend: true, impressions: true, clicks: true, conversions: true }
          }),
          app.prisma.dailyMetric.aggregate({
            where: { storeId: store.id, date: { gte: prevStart, lte: prevEnd } },
            _sum: { revenue: true, spend: true, metaRevenue: true }
          })
        ]);
        totalRevenue         = currentMetrics._sum.revenue     ?? 0;
        totalSpend           = currentMetrics._sum.spend       ?? 0;
        totalMetaRevenue     = currentMetrics._sum.metaRevenue ?? 0;
        totalImpressions     = currentMetrics._sum.impressions ?? 0;
        totalClicks          = currentMetrics._sum.clicks      ?? 0;
        totalConversions     = currentMetrics._sum.conversions ?? 0;
        prevTotalRevenue     = prevMetrics._sum.revenue     ?? 0;
        prevTotalSpend       = prevMetrics._sum.spend       ?? 0;
        prevTotalMetaRevenue = prevMetrics._sum.metaRevenue ?? 0;
      }

      // Meta ROAS: Meta-attributed revenue / Meta ad spend (pure channel attribution)
      const avgRoas        = totalSpend > 0 ? totalMetaRevenue / totalSpend : 0;
      // Blended ROAS: all store revenue (all channels) / Meta ad spend
      const avgBlendedRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
      const avgCtrVal      = totalImpressions > 0 ? totalClicks / totalImpressions : null;
      const avgConvRateVal = totalClicks > 0 ? totalConversions / totalClicks : null;

      const prevAvgRoas     = prevTotalSpend > 0 ? prevTotalMetaRevenue / prevTotalSpend : 0;
      const prevBlendedRoas = prevTotalSpend > 0 ? prevTotalRevenue     / prevTotalSpend : 0;

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

      // ── Trend chart ────────────────────────────────────────────────────────
      const revenueValues = dailyRevenue.map(d => d._sum.revenue ?? 0);
      const maxRev = Math.max(...revenueValues, 1);

      const trendSeries = dailyRevenue.map(d => {
        const rev = d._sum.revenue ?? 0;
        return {
          value: Math.max(4, Math.round((rev / maxRev) * 100)),
          label: `${fmtDate(d.date)}: ${formatCurrency(rev, cur)}`
        };
      });

      const LABEL_COUNT = 5;
      const trendLabels: string[] = dailyRevenue.length === 0 ? [] : (() => {
        const n = Math.min(LABEL_COUNT, dailyRevenue.length);
        return Array.from({ length: n }, (_, i) => {
          const idx = Math.round((i / Math.max(n - 1, 1)) * (dailyRevenue.length - 1));
          return fmtDate(dailyRevenue[idx].date);
        });
      })();

      // ── Top category by revenue ────────────────────────────────────────────
      // Use pre-computed revenue30d grouped by category instead of DailyMetric groupBy
      const allProductCats = await app.prisma.productMeta.findMany({
        where: { storeId: store.id },
        select: { category: true, revenue30d: true }
      });
      const catRevMap = new Map<string, number>();
      for (const p of allProductCats) {
        catRevMap.set(p.category, (catRevMap.get(p.category) ?? 0) + p.revenue30d);
      }
      const topCategory =
        [...catRevMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "--";

      const [latestMetaSummary, latestMetaUnmatched] = await Promise.all([
        app.prisma.auditLog.findFirst({
          where: { storeId: store.id, action: "Meta Sync — Summary" },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true, detail: true, metadata: true }
        }),
        app.prisma.auditLog.findFirst({
          where: { storeId: store.id, action: "Meta Sync — Unmatched Catalog Products" },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true, detail: true, metadata: true }
        })
      ]);

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
          avgCtr: fmtPct(avgCtrVal),
          conversionRate: fmtPct(avgConvRateVal)
        },
        syncHealth: {
          lastSyncAt: store.lastSyncAt,
          lastSyncStatus: store.lastSyncStatus,
          metaSummary: latestMetaSummary,
          metaUnmatched: latestMetaUnmatched
        },
        topProducts: topProducts.map((p) => ({
          id: p.id,
          title: p.title,
          sku: p.sku,
          imageUrl: p.imageUrl,
          score: p.score,
          category: p.category,
          roas: p.roas30d,
          blendedRoas: p.spend30d > 0 && p.revenue30d > 0 ? p.revenue30d / p.spend30d : null,
          revenue: p.revenue30d,
          metaRevenue: p.metaRevenue30d,
          spend: p.spend30d,
          margin: p.margin
        })),
        riskProducts: riskProducts.map((p) => ({
          id: p.id,
          title: p.title,
          sku: p.sku,
          imageUrl: p.imageUrl,
          score: p.score,
          category: p.category,
          roas: p.roas30d,
          revenue: p.revenue30d,
          metaRevenue: p.metaRevenue30d,
          margin: p.margin
        }))
      });
    } catch (err) {
      app.log.error({ err }, "Dashboard error");
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });
}
