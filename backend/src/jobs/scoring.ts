import type { PrismaClient, ProductCategory } from "@prisma/client";

interface MailService {
  sendScoreAlert(email: string, name: string, productTitle: string, oldCategory: string, newCategory: string, score: number): Promise<void>;
}

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
  data: { storeId: string },
  mailService?: MailService
): Promise<ScoringResult> {
  const { storeId } = data;

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { ownerId: true }
  });

  const products = await prisma.productMeta.findMany({
    where: { storeId },
    include: {
      dailyMetrics: {
        orderBy: { date: "desc" },
        take: 1
      }
    }
  });

  if (products.length === 0) {
    return { scored: 0, changed: 0, scaled: 0, killed: 0, tested: 0, risked: 0 };
  }

  let changed = 0;
  let scaled = 0;
  let killed = 0;
  let tested = 0;
  let risked = 0;

  // Process in batches to avoid overwhelming the DB
  const BATCH_SIZE = 50;
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (product) => {
        const metric = product.dailyMetrics[0];

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

        // Save score history snapshot
        await prisma.productScoreHistory.upsert({
          where: {
            productId_date: {
              productId: product.id,
              date: new Date(new Date().toISOString().split('T')[0]) // date only, no time
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

          // Send score alert email if notifications are enabled
          try {
            const settings = await prisma.userSettings.findUnique({
              where: { userId: store?.ownerId ?? "" },
              select: { notifEmailReports: true }
            });
            if (settings?.notifEmailReports && (newCategory === "KILL" || newCategory === "SCALE")) {
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

  return {
    scored: products.length,
    changed,
    scaled,
    killed,
    tested,
    risked
  };
}
