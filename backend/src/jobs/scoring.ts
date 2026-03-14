import type { PrismaClient, ProductCategory } from "@prisma/client";

/**
 * MetaFlow Scoring Engine
 *
 * Computes a 0–100 composite score for each product based on 4 weighted factors:
 *
 *   ROAS      35% — return on ad spend (5x = full marks)
 *   CTR       20% — click-through rate (3% = full marks)
 *   Margin    25% — profit margin (50% = full marks)
 *   Inventory 20% — stock level (≥10 units = full marks)
 *
 * Category thresholds:
 *   75–100 → SCALE   (increase budget, prioritize)
 *   50–74  → TEST    (maintain, watch closely)
 *   30–49  → RISK    (reduce spend, investigate)
 *   0–29   → KILL    (pause / cut budget entirely)
 */

interface ScoringMetrics {
  roas: number;         // e.g. 4.2
  ctr: number;          // e.g. 0.025 (2.5%)
  margin: number;       // e.g. 0.38 (38%)
  inventoryLevel: number | null;
}

export function computeProductScore(metrics: ScoringMetrics): number {
  // ROAS: 5x is benchmark (100%), cap at 1.0 multiplier
  const roasScore = Math.min(metrics.roas / 5, 1) * 35;

  // CTR: 3% is benchmark (100%)
  const ctrScore = Math.min(metrics.ctr / 0.03, 1) * 20;

  // Margin: 50% is benchmark (100%)
  const marginScore = Math.min(metrics.margin / 0.5, 1) * 25;

  // Inventory: ≥10 units = full score; 0 units = 0 score; null = assume sufficient (50%)
  const inventory = metrics.inventoryLevel;
  const inventoryScore = inventory === null
    ? 10                                      // unknown — neutral penalty
    : inventory >= 10
      ? 20
      : (inventory / 10) * 20;

  return Math.round(roasScore + ctrScore + marginScore + inventoryScore);
}

export function scoreToCategory(score: number): ProductCategory {
  if (score >= 75) return "SCALE";
  if (score >= 50) return "TEST";
  if (score >= 30) return "RISK";
  return "KILL";
}

/**
 * Variant for audit log styling
 * "secondary"   → SCALE (lime / good)
 * "destructive" → KILL  (ember / bad)
 * "default"     → TEST / RISK (glow / neutral)
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
 * Scores every product in a store by examining its most-recent DailyMetric.
 * Any product whose score or category changes gets updated and an AuditLog entry written.
 */
export async function runScoringJob(
  prisma: PrismaClient,
  data: { storeId: string }
): Promise<ScoringResult> {
  const { storeId } = data;

  const products = await prisma.productMeta.findMany({
    where: { storeId, isVariant: false },
    include: {
      dailyMetrics: {
        orderBy: { date: "desc" },
        take: 1
      },
      variants: {
        include: {
          dailyMetrics: {
            orderBy: { date: "desc" },
            take: 1
          }
        }
      }
    }
  });

  const variants = await prisma.productMeta.findMany({
    where: { storeId, isVariant: true },
    include: {
      dailyMetrics: {
        orderBy: { date: "desc" },
        take: 1
      }
    }
  });

  if (products.length === 0 && variants.length === 0) {
    return { scored: 0, changed: 0, scaled: 0, killed: 0, tested: 0, risked: 0 };
  }

  let changed = 0;
  let scaled = 0;
  let killed = 0;
  let tested = 0;
  let risked = 0;

  // Process in batches to avoid overwhelming the DB
  const BATCH_SIZE = 50;
  const allTargets = [...products, ...variants];
  for (let i = 0; i < allTargets.length; i += BATCH_SIZE) {
    const batch = allTargets.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (product) => {
        let metric = product.dailyMetrics[0];

        // If this is a parent product with variants, compute aggregate metrics
        // from the latest variant rows (prevents parent scores from being 0).
        if (!product.isVariant && product.variants?.length) {
          let spend = 0;
          let metaRevenue = 0;
          let impressions = 0;
          let clicks = 0;
          let conversions = 0;
          let marginSum = 0;
          let marginCount = 0;
          let inventorySum = 0;
          let inventoryCount = 0;

          for (const v of product.variants) {
            const vm = v.dailyMetrics?.[0];
            if (!vm) continue;
            spend += vm.spend ?? 0;
            metaRevenue += vm.metaRevenue ?? 0;
            impressions += vm.impressions ?? 0;
            clicks += vm.clicks ?? 0;
            conversions += vm.conversions ?? 0;
            if (typeof vm.margin === "number") {
              marginSum += vm.margin;
              marginCount += 1;
            }
            if (typeof vm.inventoryLevel === "number") {
              inventorySum += vm.inventoryLevel;
              inventoryCount += 1;
            }
          }

          if (spend > 0 || impressions > 0 || clicks > 0 || conversions > 0) {
            metric = {
              ...metric,
              roas: spend > 0 ? metaRevenue / spend : 0,
              ctr: impressions > 0 ? clicks / impressions : 0,
              conversionRate: clicks > 0 ? conversions / clicks : 0,
              margin: marginCount > 0 ? marginSum / marginCount : 0,
              inventoryLevel: inventoryCount > 0 ? inventorySum : null
            } as any;
          }
        }

        if (!metric) return;

        const newScore = computeProductScore({
          roas: metric.roas,
          ctr: metric.ctr,
          margin: metric.margin,
          inventoryLevel: metric.inventoryLevel
        });

        const newCategory = scoreToCategory(newScore);
        const oldCategory = product.category;
        const oldScore = product.score;

        const scoreShifted = Math.abs(newScore - oldScore) >= 2;
        const categoryChanged = newCategory !== oldCategory;

        if (!scoreShifted && !categoryChanged) return;

        // Update product score + category
        await prisma.productMeta.update({
          where: { id: product.id },
          data: { score: newScore, category: newCategory }
        });

        changed++;

        // Write an audit log entry for category transitions
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

          if (newCategory === "SCALE") scaled++;
          else if (newCategory === "KILL") killed++;
          else if (newCategory === "TEST") tested++;
          else if (newCategory === "RISK") risked++;
        }
      })
    );
  }

  return {
    scored: products.length,
    changed,
    scaled,
    killed,
    tested,
    risked
  };
}
