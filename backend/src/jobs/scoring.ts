import type { PrismaClient, ProductCategory } from "@prisma/client";

interface MailService {
  sendScoreAlert(email: string, name: string, productTitle: string, oldCategory: string, newCategory: string, score: number): Promise<void>;
}

/**
 * MetaFlow Scoring Engine
 *
 * Computes a 0–100 composite score for each product based on 4 weighted factors:
 *
 *   ROAS      35% — return on ad spend  (benchmark: user-configurable, default 5x)
 *   CTR       20% — click-through rate  (benchmark: user-configurable, default 3%)
 *   Margin    25% — profit margin       (benchmark: user-configurable, default 50%)
 *   Inventory 20% — stock level         (benchmark: user-configurable, default ≥10 units)
 *
 * Category thresholds (user-configurable, defaults):
 *   ≥ thresholdScale (75) → SCALE   (increase budget, prioritize)
 *   ≥ thresholdTest  (50) → TEST    (maintain, watch closely)
 *   ≥ thresholdKill  (25) → RISK    (reduce spend, investigate)
 *   <  thresholdKill (25) → KILL    (pause / cut budget entirely)
 */

interface ScoringMetrics {
  roas: number;
  ctr: number;
  margin: number;
  inventoryLevel: number | null;
}

export interface ScoringBenchmarks {
  roasBenchmark: number;
  ctrBenchmark: number;
  marginBenchmark: number;
  inventoryBenchmark: number;
}

export interface CategoryThresholds {
  thresholdScale: number;
  thresholdTest: number;
  thresholdKill: number;
}

export const DEFAULT_BENCHMARKS: ScoringBenchmarks = {
  roasBenchmark: 5,
  ctrBenchmark: 0.03,
  marginBenchmark: 0.5,
  inventoryBenchmark: 10,
};

export const DEFAULT_THRESHOLDS: CategoryThresholds = {
  thresholdScale: 75,
  thresholdTest: 50,
  thresholdKill: 25,
};

export function computeProductScore(
  metrics: ScoringMetrics,
  benchmarks: ScoringBenchmarks = DEFAULT_BENCHMARKS
): number {
  const { roasBenchmark, ctrBenchmark, marginBenchmark, inventoryBenchmark } = benchmarks;

  // ROAS: benchmark = full marks (35pts)
  const roasScore = Math.min(metrics.roas / roasBenchmark, 1) * 35;

  // CTR: benchmark = full marks (20pts)
  const ctrScore = Math.min(metrics.ctr / ctrBenchmark, 1) * 20;

  // Margin: benchmark = full marks (25pts)
  const marginScore = Math.min(metrics.margin / marginBenchmark, 1) * 25;

  // Inventory: benchmark units = full marks (20pts); null = neutral (10pts)
  const inventory = metrics.inventoryLevel;
  const inventoryScore = inventory === null
    ? 10
    : inventory >= inventoryBenchmark
      ? 20
      : (inventory / inventoryBenchmark) * 20;

  return Math.round(roasScore + ctrScore + marginScore + inventoryScore);
}

export function scoreToCategory(
  score: number,
  thresholds: CategoryThresholds = DEFAULT_THRESHOLDS
): ProductCategory {
  const { thresholdScale, thresholdTest, thresholdKill } = thresholds;
  if (score >= thresholdScale) return "SCALE";
  if (score >= thresholdTest)  return "TEST";
  if (score >= thresholdKill)  return "RISK";
  return "KILL";
}

/**
 * Variant for audit log styling
 */
function categoryToVariant(category: ProductCategory): string {
  if (category === "SCALE") return "secondary";
  if (category === "KILL") return "destructive";
  return "default";
}

interface ScoringResult {
  scored: number;
  changed: number;
  scaled: number;
  killed: number;
  tested: number;
  risked: number;
}

/**
 * runScoringJob
 *
 * Scores every product in a store using 30-day aggregated metrics.
 * Uses a single batch groupBy query instead of N per-product queries.
 * Writes pre-computed aggregates back to ProductMeta so the products
 * page can read directly without re-aggregating DailyMetric on every request.
 */
export async function runScoringJob(
  prisma: PrismaClient,
  data: { storeId: string },
  mailService?: MailService
): Promise<ScoringResult> {
  const { storeId } = data;

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { ownerId: true }
  });

  // Load user's custom benchmarks and thresholds up front
  const userSettings = store?.ownerId
    ? await prisma.userSettings.findUnique({
        where: { userId: store.ownerId },
        select: {
          benchmarkRoas: true, benchmarkCtr: true,
          benchmarkMargin: true, benchmarkInventory: true,
          thresholdScale: true, thresholdTest: true, thresholdKill: true,
          notifEmailReports: true,
        },
      })
    : null;

  // Load store-level benchmark overrides (take precedence over user-level settings)
  const storeData = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      benchmarkRoas: true, benchmarkCtr: true,
      benchmarkMargin: true, benchmarkInventory: true,
    }
  });

  const benchmarks: ScoringBenchmarks = {
    roasBenchmark:      storeData?.benchmarkRoas      ?? userSettings?.benchmarkRoas      ?? DEFAULT_BENCHMARKS.roasBenchmark,
    ctrBenchmark:       storeData?.benchmarkCtr       ?? userSettings?.benchmarkCtr       ?? DEFAULT_BENCHMARKS.ctrBenchmark,
    marginBenchmark:    storeData?.benchmarkMargin     ?? userSettings?.benchmarkMargin    ?? DEFAULT_BENCHMARKS.marginBenchmark,
    inventoryBenchmark: storeData?.benchmarkInventory  ?? userSettings?.benchmarkInventory ?? DEFAULT_BENCHMARKS.inventoryBenchmark,
  };

  const thresholds: CategoryThresholds = {
    thresholdScale: userSettings?.thresholdScale ?? DEFAULT_THRESHOLDS.thresholdScale,
    thresholdTest:  userSettings?.thresholdTest  ?? DEFAULT_THRESHOLDS.thresholdTest,
    thresholdKill:  userSettings?.thresholdKill  ?? DEFAULT_THRESHOLDS.thresholdKill,
  };

  // Load products without DailyMetric include — aggregates fetched below in one query
  const products = await prisma.productMeta.findMany({
    where: { storeId },
    select: { id: true, title: true, category: true, score: true, isVariant: true, parentId: true }
  });

  if (products.length === 0) {
    return { scored: 0, changed: 0, scaled: 0, killed: 0, tested: 0, risked: 0 };
  }

  // Batch groupBy for 30-day AND 7-day aggregates — run in parallel.
  const now30 = new Date();
  const since30 = new Date(now30);
  since30.setDate(since30.getDate() - 30);
  since30.setHours(0, 0, 0, 0);

  const since7 = new Date(now30);
  since7.setDate(since7.getDate() - 7);
  since7.setHours(0, 0, 0, 0);

  const AGG_SUM_FIELDS = {
    spend: true, revenue: true, metaRevenue: true,
    impressions: true, clicks: true, conversions: true,
    addToCart: true, addToCartOmni: true,
    checkoutInitiated: true, checkoutInitiatedOmni: true,
  } as const;

  const [metrics30d, metrics7d] = await Promise.all([
    prisma.dailyMetric.groupBy({
      by: ["productId"],
      where: { storeId, date: { gte: since30 } },
      _sum: AGG_SUM_FIELDS,
      _avg: { margin: true },
      _max: { inventoryLevel: true },
    }),
    prisma.dailyMetric.groupBy({
      by: ["productId"],
      where: { storeId, date: { gte: since7 } },
      _sum: AGG_SUM_FIELDS,
    }),
  ]);

  const metricMap  = new Map(metrics30d.map(m => [m.productId, m]));
  const metricMap7 = new Map(metrics7d.map(m => [m.productId, m]));
  const computedAt = new Date();

  // Roll up variant metrics to their parent for 30d/7d aggregates.
  type Rollup = {
    spend: number;
    revenue: number;
    metaRevenue: number;
    impressions: number;
    clicks: number;
    conversions: number;
    addToCart: number;
    addToCartOmni: number;
    checkoutInitiated: number;
    checkoutInitiatedOmni: number;
    marginWeightedSum: number;
    marginWeight: number;
    inventorySum: number;
  };

  const productIndex = new Map(products.map(p => [p.id, p]));

  const rollup30d = new Map<string, Rollup>();
  for (const m of metrics30d) {
    const p = productIndex.get(m.productId);
    const rootId = p?.parentId ?? m.productId;
    const rev = m._sum.revenue ?? 0;
    const weight = rev > 0 ? rev : 1;
    const margin = m._avg.margin ?? 0.35;
    const inventory = m._max.inventoryLevel ?? 0;
    const acc = rollup30d.get(rootId) ?? {
      spend: 0, revenue: 0, metaRevenue: 0,
      impressions: 0, clicks: 0, conversions: 0,
      addToCart: 0, addToCartOmni: 0,
      checkoutInitiated: 0, checkoutInitiatedOmni: 0,
      marginWeightedSum: 0, marginWeight: 0,
      inventorySum: 0,
    };
    acc.spend += m._sum.spend ?? 0;
    acc.revenue += rev;
    acc.metaRevenue += m._sum.metaRevenue ?? 0;
    acc.impressions += m._sum.impressions ?? 0;
    acc.clicks += m._sum.clicks ?? 0;
    acc.conversions += m._sum.conversions ?? 0;
    acc.addToCart += m._sum.addToCart ?? 0;
    acc.addToCartOmni += m._sum.addToCartOmni ?? 0;
    acc.checkoutInitiated += m._sum.checkoutInitiated ?? 0;
    acc.checkoutInitiatedOmni += m._sum.checkoutInitiatedOmni ?? 0;
    acc.marginWeightedSum += margin * weight;
    acc.marginWeight += weight;
    acc.inventorySum += inventory;
    rollup30d.set(rootId, acc);
  }

  const rollup7d = new Map<string, Omit<Rollup, "marginWeightedSum" | "marginWeight" | "inventorySum"> & { inventorySum?: number }>();
  for (const m of metrics7d) {
    const p = productIndex.get(m.productId);
    const rootId = p?.parentId ?? m.productId;
    const acc = rollup7d.get(rootId) ?? {
      spend: 0, revenue: 0, metaRevenue: 0,
      impressions: 0, clicks: 0, conversions: 0,
      addToCart: 0, addToCartOmni: 0,
      checkoutInitiated: 0, checkoutInitiatedOmni: 0,
    };
    acc.spend += m._sum.spend ?? 0;
    acc.revenue += m._sum.revenue ?? 0;
    acc.metaRevenue += m._sum.metaRevenue ?? 0;
    acc.impressions += m._sum.impressions ?? 0;
    acc.clicks += m._sum.clicks ?? 0;
    acc.conversions += m._sum.conversions ?? 0;
    acc.addToCart += m._sum.addToCart ?? 0;
    acc.addToCartOmni += m._sum.addToCartOmni ?? 0;
    acc.checkoutInitiated += m._sum.checkoutInitiated ?? 0;
    acc.checkoutInitiatedOmni += m._sum.checkoutInitiatedOmni ?? 0;
    rollup7d.set(rootId, acc);
  }

  let changed = 0;
  let scaled = 0;
  let killed = 0;
  let tested = 0;
  let risked = 0;

  const BATCH_SIZE = 50;
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (product) => {
        const rootId = product.parentId ?? product.id;
        const m  = product.isVariant ? metricMap.get(product.id) : undefined;
        const m7 = product.isVariant ? metricMap7.get(product.id) : undefined;
        const r  = product.isVariant ? undefined : rollup30d.get(rootId);
        const r7 = product.isVariant ? undefined : rollup7d.get(rootId);

        const spend30d       = product.isVariant ? (m?._sum.spend        ?? 0) : (r?.spend ?? 0);
        const revenue30d     = product.isVariant ? (m?._sum.revenue      ?? 0) : (r?.revenue ?? 0);
        const metaRevenue30d = product.isVariant ? (m?._sum.metaRevenue  ?? 0) : (r?.metaRevenue ?? 0);
        const impressions30d = product.isVariant ? (m?._sum.impressions  ?? 0) : (r?.impressions ?? 0);
        const clicks30d      = product.isVariant ? (m?._sum.clicks       ?? 0) : (r?.clicks ?? 0);
        const conversions30d = product.isVariant ? (m?._sum.conversions  ?? 0) : (r?.conversions ?? 0);
        const margin         = product.isVariant
          ? (m?._avg.margin ?? 0.35)
          : ((r?.marginWeight ?? 0) > 0 ? (r!.marginWeightedSum / r!.marginWeight) : 0.35);
        const inventoryLevel = product.isVariant
          ? (m?._max.inventoryLevel ?? null)
          : (r ? Math.max(0, r.inventorySum) : null);
        const roas30d        = spend30d > 0 && metaRevenue30d > 0 ? metaRevenue30d / spend30d : 0;
        const ctr30d         = impressions30d > 0 ? clicks30d / impressions30d : 0;
        const addToCart30d           = product.isVariant ? (m?._sum.addToCart        ?? 0) : (r?.addToCart ?? 0);
        const addToCartOmni30d       = product.isVariant ? (m?._sum.addToCartOmni    ?? 0) : (r?.addToCartOmni ?? 0);
        const checkoutInitiated30d   = product.isVariant ? (m?._sum.checkoutInitiated    ?? 0) : (r?.checkoutInitiated ?? 0);
        const checkoutInitiatedOmni30d = product.isVariant ? (m?._sum.checkoutInitiatedOmni ?? 0) : (r?.checkoutInitiatedOmni ?? 0);

        // 7-day aggregates
        const spend7d       = product.isVariant ? (m7?._sum.spend        ?? 0) : (r7?.spend ?? 0);
        const revenue7d     = product.isVariant ? (m7?._sum.revenue      ?? 0) : (r7?.revenue ?? 0);
        const metaRevenue7d = product.isVariant ? (m7?._sum.metaRevenue  ?? 0) : (r7?.metaRevenue ?? 0);
        const impressions7d = product.isVariant ? (m7?._sum.impressions  ?? 0) : (r7?.impressions ?? 0);
        const clicks7d      = product.isVariant ? (m7?._sum.clicks       ?? 0) : (r7?.clicks ?? 0);
        const conversions7d = product.isVariant ? (m7?._sum.conversions  ?? 0) : (r7?.conversions ?? 0);
        const roas7d        = spend7d > 0 && metaRevenue7d > 0 ? metaRevenue7d / spend7d : 0;
        const ctr7d         = impressions7d > 0 ? clicks7d / impressions7d : 0;
        const addToCart7d            = product.isVariant ? (m7?._sum.addToCart        ?? 0) : (r7?.addToCart ?? 0);
        const addToCartOmni7d        = product.isVariant ? (m7?._sum.addToCartOmni    ?? 0) : (r7?.addToCartOmni ?? 0);
        const checkoutInitiated7d    = product.isVariant ? (m7?._sum.checkoutInitiated    ?? 0) : (r7?.checkoutInitiated ?? 0);
        const checkoutInitiatedOmni7d = product.isVariant ? (m7?._sum.checkoutInitiatedOmni ?? 0) : (r7?.checkoutInitiatedOmni ?? 0);

        const newScore = computeProductScore(
          { roas: roas30d, ctr: ctr30d, margin, inventoryLevel },
          benchmarks
        );

        const newCategory = scoreToCategory(newScore, thresholds);
        const oldCategory = product.category;
        const oldScore = product.score;

        const scoreShifted = Math.abs(newScore - oldScore) >= 2;
        const categoryChanged = newCategory !== oldCategory;

        await prisma.productMeta.update({
          where: { id: product.id },
          data: {
            spend30d, revenue30d, metaRevenue30d,
            impressions30d, clicks30d, conversions30d,
            roas30d, ctr30d, margin, inventoryLevel,
            addToCart30d, addToCartOmni30d,
            checkoutInitiated30d, checkoutInitiatedOmni30d,
            spend7d, revenue7d, metaRevenue7d,
            impressions7d, clicks7d, conversions7d,
            roas7d, ctr7d,
            addToCart7d, addToCartOmni7d,
            checkoutInitiated7d, checkoutInitiatedOmni7d,
            metricsComputedAt: computedAt,
            ...(scoreShifted || categoryChanged
              ? { score: newScore, category: newCategory }
              : {}),
          }
        });

        if (!scoreShifted && !categoryChanged) return;

        await prisma.productScoreHistory.upsert({
          where: {
            productId_date: {
              productId: product.id,
              date: new Date(new Date().toISOString().split('T')[0])
            }
          },
          update: { score: newScore, category: newCategory },
          create: {
            productId: product.id,
            storeId,
            score: newScore,
            category: newCategory,
            date: new Date(new Date().toISOString().split('T')[0])
          }
        });

        changed++;

        if (categoryChanged) {
          const actionLabel = newCategory === "SCALE"
            ? "Budget Scaled"
            : newCategory === "KILL"
              ? "Ad Paused"
              : newCategory === "RISK"
                ? "Risk Flagged"
                : "Status Updated";

          await prisma.auditLog.create({
            data: {
              action: actionLabel,
              detail: `${product.title}: ${oldCategory} → ${newCategory} (score ${oldScore} → ${newScore})`,
              metadata: {
                productId: product.id,
                oldCategory,
                newCategory,
                oldScore,
                newScore,
                variant: categoryToVariant(newCategory),
                tag: newCategory
              },
              storeId
            }
          });

          // Send score alert email if notifications are enabled
          try {
            if (userSettings?.notifEmailReports && (newCategory === "KILL" || newCategory === "SCALE")) {
              const owner = await prisma.user.findUnique({
                where: { id: store?.ownerId ?? "" },
                select: { email: true, name: true }
              });
              if (owner && mailService) {
                mailService.sendScoreAlert(
                  owner.email,
                  owner.name ?? "",
                  product.title,
                  oldCategory,
                  newCategory,
                  newScore
                ).catch(() => {});
              }
            }
          } catch {}

          if (newCategory === "SCALE") scaled++;
          else if (newCategory === "KILL") killed++;
          else if (newCategory === "TEST") tested++;
          else if (newCategory === "RISK") risked++;
        }
      })
    );
  }

  return { scored: products.length, changed, scaled, killed, tested, risked };
}
