/**
 * MetaFlow Data Retention Job
 * ─────────────────────────────────────────────────────────────────────────────
 * Prunes time-series rows that have exceeded their retention window.
 * Runs nightly at 3:00 AM in the worker process.
 *
 * Retention windows:
 *   DailyMetric        — 2 years  (730 days)
 *   ProductScoreHistory — 1 year  (365 days)
 *   ProductRollupDaily  — 90 days (superseded by rollup job, but explicit cleanup)
 *   AuditLog            — 1 year  (365 days)
 *
 * These are global deletes — not per-store — because the goal is simply to
 * prevent unbounded table growth. Per-store retention overrides could be added
 * later if needed (e.g. a paid feature: "extended history").
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type { PrismaClient } from "@prisma/client";

export interface RetentionResult {
  dailyMetrics:  number;
  scoreHistory:  number;
  rollupDaily:   number;
  auditLogs:     number;
  durationMs:    number;
}

const WINDOWS = {
  dailyMetric:        730, // days
  productScoreHistory: 365,
  productRollupDaily:   90,
  auditLog:            365,
};

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

async function safeDelete(
  label: string,
  fn: () => Promise<{ count: number }>,
  log: (msg: string, count?: number) => void
): Promise<number> {
  try {
    const { count } = await fn();
    log(`[retention] ${label}: pruned ${count} rows`);
    return count;
  } catch (err) {
    // Per-table isolation — one slow/locked table doesn't abort the others.
    log(`[retention] ${label}: ERROR — ${(err as Error).message}`);
    return -1; // -1 signals partial failure in the result
  }
}

export async function runRetentionJob(
  prisma: PrismaClient,
  logger: { info: (msg: string) => void; warn: (msg: string) => void } = {
    info: (m) => console.info(m),
    warn: (m) => console.warn(m),
  }
): Promise<RetentionResult> {
  const startedAt = Date.now();

  // Run each table independently — a timeout on one does NOT cancel the others.
  const [dailyMetrics, scoreHistory, rollupDaily, auditLogs] = await Promise.all([
    safeDelete("DailyMetric (2yr)",
      () => prisma.dailyMetric.deleteMany({ where: { date: { lt: daysAgo(WINDOWS.dailyMetric) } } }),
      logger.info
    ),
    safeDelete("ProductScoreHistory (1yr)",
      () => prisma.productScoreHistory.deleteMany({ where: { date: { lt: daysAgo(WINDOWS.productScoreHistory) } } }),
      logger.info
    ),
    safeDelete("ProductRollupDaily (90d)",
      () => prisma.productRollupDaily.deleteMany({ where: { date: { lt: daysAgo(WINDOWS.productRollupDaily) } } }),
      logger.info
    ),
    safeDelete("AuditLog (1yr)",
      () => prisma.auditLog.deleteMany({ where: { createdAt: { lt: daysAgo(WINDOWS.auditLog) } } }),
      logger.info
    ),
  ]);

  return {
    dailyMetrics,
    scoreHistory,
    rollupDaily,
    auditLogs,
    durationMs: Date.now() - startedAt,
  };
}
