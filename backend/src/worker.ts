/**
 * MetaFlow Background Worker
 *
 * Processes jobs from BullMQ queues:
 *   - "sync"      — platform data sync (Shopify, WooCommerce, Meta Ads)
 *   - "scoring"   — product scoring engine
 *   - "rollup"    — daily metric aggregation / variant rollup
 *   - "retention" — nightly DB pruning (DailyMetric, ScoreHistory, AuditLog)
 *
 * Run this process independently from the API server:
 *   node --loader ts-node/esm src/worker.ts
 */
import * as Sentry from "@sentry/node";
import { Worker, Queue } from "bullmq";
import Redis from "ioredis";
import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";
import { runScoringJob } from "./jobs/scoring.js";
import { runShopifySync } from "./jobs/syncShopify.js";
import { runWooCommerceSync } from "./jobs/syncWooCommerce.js";
import { runMetaSync, MetaAuthError } from "./jobs/syncMeta.js";
import { runProductRollupJob } from "./jobs/rollup.js";
import { runRetentionJob } from "./jobs/retention.js";
import { runWeeklyDigestJob } from "./jobs/weeklyDigest.js";
import { decryptToken } from "./utils/crypto.js";
import { storeLocalHour, storeLocalDateStr, storeLocalDayBounds } from "./jobs/dateUtils.js";

// ─── Sentry ───────────────────────────────────────────────────────────────────
// Init before anything else so unhandled errors are captured from the start.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn:                process.env.SENTRY_DSN,
    environment:        process.env.NODE_ENV ?? "production",
    tracesSampleRate:   0.05,   // 5% of transactions — low enough to not bloat quota
    release:            process.env.SENTRY_RELEASE ?? undefined,
  });
  console.log("[worker] Sentry initialised");
}

// ─── Connections ──────────────────────────────────────────────────────────────
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null
});

const prisma = new PrismaClient();
const rollupQueue     = new Queue("rollup",     { connection });
const retentionQueue  = new Queue("retention",  { connection });
const scoringQueue    = new Queue("scoring",    { connection });
const weeklyQueue     = new Queue("weekly",     { connection });

// ─── Mail service (lightweight, for scoring alerts) ───────────────────────────
const smtpTransport = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
    })
  : null;

const workerMailService = {
  async sendScoreAlert(email: string, name: string, productTitle: string, oldCategory: string, newCategory: string, score: number) {
    if (!smtpTransport) return;
    const from = process.env.SMTP_FROM ?? "no-reply@metaflow.app";
    const subject = `Score alert: ${productTitle} moved to ${newCategory}`;
    const html = `<p>Hey ${name || "there"}, <strong>${productTitle}</strong> changed from ${oldCategory} to ${newCategory} (score: ${score}/100).</p>`;
    await smtpTransport.sendMail({ from, to: email, subject, html });
  },

  async sendWeeklyDigest(
    email: string,
    name: string,
    storeName: string,
    stats: { scaled: number; killed: number; tested: number; risked: number; totalProducts: number; topProduct?: string }
  ) {
    if (!smtpTransport) return;
    const from = process.env.SMTP_FROM ?? "no-reply@metaflow.app";
    const subject = `Your MetaFlow weekly digest — ${storeName}`;
    const top = stats.topProduct ? `<p>Top performer: <strong>${stats.topProduct}</strong></p>` : "";
    const html = `
      <p>Hey ${name || "there"}, here's your weekly MetaFlow digest for <strong>${storeName}</strong>:</p>
      <ul>
        <li>🚀 Scale: <strong>${stats.scaled}</strong></li>
        <li>⚠️ Risk: <strong>${stats.risked}</strong></li>
        <li>🧪 Test: <strong>${stats.tested}</strong></li>
        <li>☠️ Kill: <strong>${stats.killed}</strong></li>
        <li>📦 Total: <strong>${stats.totalProducts}</strong></li>
      </ul>
      ${top}
      <p><a href="${process.env.APP_URL ?? "https://app.metaflow.ai"}/app/products">View your products →</a></p>
    `;
    await smtpTransport.sendMail({ from, to: email, subject, html });
  }
};

// ─── Sync Queue Worker ────────────────────────────────────────────────────────
// Handles: shopify-sync, woocommerce-sync, meta-sync

const syncWorker = new Worker(
  "sync",
  async (job) => {
    const { provider, storeId } = job.data as { provider: string; storeId: string };
    console.log(`[sync] Job ${job.id} — ${provider} sync for store ${storeId}`);

    // Mark store as actively syncing
    await prisma.store.update({
      where: { id: storeId },
      data: { lastSyncStatus: "RUNNING", lastSyncError: null, lastSyncProvider: provider }
    }).catch(() => {});

    try {
      // Look up the store's timezone and currency once — used by all sync providers
      const storeRecord = await prisma.store.findUnique({
        where: { id: storeId },
        select: { timezone: true, currency: true }
      });
      const timezone      = storeRecord?.timezone ?? "Africa/Lagos";
      const storeCurrency = storeRecord?.currency ?? undefined;

      switch (provider) {
        case "SHOPIFY": {
          const { shop, accessToken } = job.data as { shop: string; accessToken: string };
          const result = await runShopifySync(prisma, { storeId, shop, accessToken, timezone, storeCurrency });
          console.log(`[sync] Shopify complete — ${result.products} products, ${result.orders} orders`);

          await prisma.auditLog.create({
            data: {
              action: "Shopify Synced",
              detail: `Synced ${result.products} products and ${result.orders} orders from Shopify`,
              metadata: { provider: "SHOPIFY", ...result, variant: "default", tag: "Info" },
              storeId
            }
          });
          await prisma.store.update({
            where: { id: storeId },
            data: { lastSyncStatus: "SUCCESS", lastSyncAt: new Date() }
          }).catch(() => {});
          await rollupQueue.add(
            "rollup-store",
            { storeId },
            { jobId: `rollup:${storeId}:${new Date().toISOString().slice(0, 10)}` }
          ).catch(() => {});
          // Chain the next day's sync — O(1), no polling needed
          await scheduleNextSync(storeId).catch(() => {});
          await scheduleNextRollup(storeId).catch(() => {});
          return result;
        }

        case "WOOCOMMERCE": {
          const { storeUrl, accessToken } = job.data as { storeUrl: string; accessToken: string };
          const result = await runWooCommerceSync(prisma, { storeId, storeUrl, accessToken, timezone });
          console.log(`[sync] WooCommerce complete — ${result.products} products, ${result.orders} orders`);

          await prisma.auditLog.create({
            data: {
              action: "WooCommerce Synced",
              detail: `Synced ${result.products} products and ${result.orders} orders from WooCommerce`,
              metadata: { provider: "WOOCOMMERCE", ...result, variant: "default", tag: "Info" },
              storeId
            }
          });
          await prisma.store.update({
            where: { id: storeId },
            data: { lastSyncStatus: "SUCCESS", lastSyncAt: new Date() }
          }).catch(() => {});
          await rollupQueue.add(
            "rollup-store",
            { storeId },
            { jobId: `rollup:${storeId}:${new Date().toISOString().slice(0, 10)}` }
          ).catch(() => {});
          // Chain the next day's sync — O(1), no polling needed
          await scheduleNextSync(storeId).catch(() => {});
          await scheduleNextRollup(storeId).catch(() => {});
          return result;
        }

        case "META": {
          const { accessToken, metaAdAccountId, metaCatalogId } = job.data as {
            accessToken: string;
            metaAdAccountId?: string | null;
            metaCatalogId?: string | null;
          };
          const result = await runMetaSync(prisma, { storeId, accessToken, metaAdAccountId, metaCatalogId, timezone });
          console.log(
            `[sync] Meta complete — ${result.adAccounts} accounts, ${result.insightsMatched} insights matched` +
            (result.unmatchedCatalogItems > 0 ? `, ${result.unmatchedCatalogItems} unmatched catalog items` : "")
          );

          await prisma.auditLog.create({
            data: {
              action: "Meta Ads Synced",
              detail: `Matched ${result.insightsMatched} ad insights across ${result.adAccounts} ad accounts` +
                (result.unmatchedCatalogItems > 0
                  ? `. ${result.unmatchedCatalogItems} catalog product(s) could not be matched — see "Meta Sync — Unmatched Catalog Products" audit entry for details.`
                  : ""),
              metadata: { provider: "META", ...result, variant: "default", tag: "Info" },
              storeId
            }
          });
          await prisma.store.update({
            where: { id: storeId },
            data: { lastSyncStatus: "SUCCESS", lastSyncAt: new Date() }
          }).catch(() => {});
          await rollupQueue.add(
            "rollup-store",
            { storeId },
            { jobId: `rollup:${storeId}:${new Date().toISOString().slice(0, 10)}` }
          ).catch(() => {});
          // Chain the next day's sync — O(1), no polling needed
          await scheduleNextSync(storeId).catch(() => {});
          await scheduleNextRollup(storeId).catch(() => {});
          return result;
        }

        default:
          throw new Error(`Unknown sync provider: ${provider}`);
      }
    } catch (err) {
      console.error(`[sync] Job ${job.id} failed:`, err);
      // MetaAuthError means the token is expired/revoked — user must reconnect.
      // Write NEEDS_REAUTH so the frontend can show a specific reconnect prompt
      // rather than a generic "sync failed" message.
      const isAuthErr = err instanceof MetaAuthError;
      await prisma.store.update({
        where: { id: storeId },
        data: {
          lastSyncStatus: isAuthErr ? "NEEDS_REAUTH" : "ERROR",
          lastSyncError: (err instanceof Error ? err.message : String(err)).slice(0, 500)
        }
      }).catch(() => {});
      throw err; // Re-throw so BullMQ handles retries
    }
  },
  {
    connection,
    concurrency: 3 // Process up to 3 sync jobs simultaneously
  }
);

// ─── Rollup Queue Worker ─────────────────────────────────────────────────────
// Handles: rollup-store
const rollupWorker = new Worker(
  "rollup",
  async (job) => {
    const { storeId } = job.data as { storeId: string };
    console.log(`[rollup] Job ${job.id} — rollup for store ${storeId}`);

    await prisma.store.update({
      where: { id: storeId },
      data: { lastRollupStatus: "RUNNING", lastRollupError: null }
    }).catch(() => {});

    try {
      const startedAt = Date.now();
      const result = await runProductRollupJob(prisma, { storeId, days: 90 });
      const durationMs = Date.now() - startedAt;
      console.log(`[rollup] Complete — ${result.rows} rows in ${durationMs}ms`);

      await prisma.auditLog.create({
        data: {
          action: "Rollup Complete",
          detail: `Rolled up ${result.rows} rows in ${Math.round(durationMs / 1000)}s`,
          metadata: { rows: result.rows, durationMs, variant: "default", tag: "Info" },
          storeId
        }
      }).catch(() => {});

      await prisma.store.update({
        where: { id: storeId },
        data: { lastRollupStatus: "SUCCESS", lastRollupAt: new Date() }
      }).catch(() => {});

      // Trigger scoring after rollup so products are re-categorised on every nightly
      // sync — not only when the user manually presses "Sync" in the UI.
      await scoringQueue.add(
        "score-store",
        { storeId },
        { attempts: 2, backoff: { type: "fixed", delay: 5000 } }
      ).catch((err) => console.warn(`[rollup] Failed to enqueue scoring job for ${storeId}:`, err));

      return result;
    } catch (err) {
      console.error(`[rollup] Job ${job.id} failed:`, err);
      await prisma.store.update({
        where: { id: storeId },
        data: {
          lastRollupStatus: "ERROR",
          lastRollupError: (err instanceof Error ? err.message : String(err)).slice(0, 500)
        }
      }).catch(() => {});
      throw err;
    }
  },
  { connection, concurrency: 1 }
);

// ─── Retention Queue Worker ───────────────────────────────────────────────────
// Handles: run-retention (fires nightly at 3:00 AM, globally — not per-store)
const retentionWorker = new Worker(
  "retention",
  async (job) => {
    console.log(`[retention] Job ${job.id} — pruning old time-series rows`);
    try {
      const result = await runRetentionJob(prisma);
      console.log(
        `[retention] Complete in ${result.durationMs}ms — ` +
        `DailyMetric: ${result.dailyMetrics}, ScoreHistory: ${result.scoreHistory}, ` +
        `RollupDaily: ${result.rollupDaily}, AuditLog: ${result.auditLogs} rows pruned`
      );
      return result;
    } catch (err) {
      console.error(`[retention] Job ${job.id} failed:`, err);
      Sentry.captureException(err, { extra: { jobId: job.id, queue: "retention" } });
      throw err;
    }
  },
  { connection, concurrency: 1 }
);

// ─── Scoring Queue Worker ─────────────────────────────────────────────────────
// Handles: score-store

const scoringWorker = new Worker(
  "scoring",
  async (job) => {
    const { storeId } = job.data as { storeId: string };
    console.log(`[scoring] Job ${job.id} — scoring products for store ${storeId}`);

    try {
      const result = await runScoringJob(prisma, { storeId }, workerMailService);
      console.log(
        `[scoring] Complete — ${result.scored} scored, ${result.changed} changed ` +
        `(${result.scaled} scaled, ${result.killed} killed, ${result.risked} at risk)`
      );

      if (result.changed > 0) {
        await prisma.auditLog.create({
          data: {
            action: "Scoring Run Complete",
            detail: `Scored ${result.scored} products: ${result.scaled} scaled, ${result.killed} killed, ${result.risked} flagged at risk`,
            metadata: { ...result, variant: "default", tag: "Info" },
            storeId
          }
        });
      }

      return result;
    } catch (err) {
      console.error(`[scoring] Job ${job.id} failed:`, err);
      throw err;
    }
  },
  {
    connection,
    concurrency: 2
  }
);

// ─── Weekly Digest Queue Worker ───────────────────────────────────────────────
// Handles: run-weekly-digest (fires every Monday 8:00 AM UTC)
const weeklyWorker = new Worker(
  "weekly",
  async (job) => {
    console.log(`[weekly] Job ${job.id} — sending weekly digest emails`);
    try {
      const result = await runWeeklyDigestJob(prisma, workerMailService);
      console.log(
        `[weekly] Complete — ${result.emailsSent} sent, ${result.emailsFailed} failed ` +
        `(${result.usersProcessed} users processed)`
      );
      return result;
    } catch (err) {
      console.error(`[weekly] Job ${job.id} failed:`, err);
      Sentry.captureException(err, { extra: { jobId: job.id, queue: "weekly" } });
      throw err;
    }
  },
  { connection, concurrency: 1 }
);

// ─── Self-scheduling daily sync ───────────────────────────────────────────────
//
// DESIGN: Instead of an hourly polling loop that scans all stores, each store
// schedules its OWN next sync as a delayed BullMQ job the moment its current
// sync completes. This is O(1) per store per day — not O(n) per hour.
//
// Benefits over the polling approach:
//   • No full-table scan — the queue IS the schedule
//   • Delayed jobs survive restarts (stored in Redis). If the worker was down
//     during a store's 2am window, the job fires immediately on restart.
//   • Zero wasted work — the worker wakes up only when there's actually
//     a sync to run, not to check thousands of stores that aren't due yet.
//   • Scales to any number of stores with no architectural changes.
//
// How it works:
//   1. A store's first sync is scheduled when it connects (see connections route).
//   2. After every successful sync, scheduleNextSync() is called, which adds a
//      delayed job set to fire at 2:00:00am tomorrow in the store's local timezone.
//   3. The jobId "daily-{storeId}-{provider}" is stable — if the job already
//      exists in the queue (e.g., worker restarted after crash), BullMQ deduplicates
//      it so it won't double-queue.

const syncQueue = new Queue("sync", { connection });

/**
 * Computes the UTC timestamp of 2:00 AM tomorrow in the given timezone,
 * then adds a delayed sync job for each platform the store has connected.
 *
 * Called after every successful sync to chain the next day's sync.
 */
export async function scheduleNextSync(storeId: string): Promise<void> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      storeUrl: true,
      timezone: true,
      connections: {
        select: {
          provider: true,
          accessToken: true,
          metaAdAccountId: true,
          metaCatalogId: true
        }
      }
    }
  });
  if (!store) return;

  const tz = store.timezone ?? "Africa/Lagos";

  // Compute 2:00 AM tomorrow in the store's local timezone
  // Step 1: find the UTC ms for tomorrow's local midnight
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86_400_000); // +24h
  const { start: tomorrowMidnight } = storeLocalDayBounds(tz, tomorrow);
  // Step 2: add 2 hours → 2:00 AM local = midnight UTC + 2h
  const next2am = new Date(tomorrowMidnight.getTime() + 2 * 60 * 60 * 1000);
  const delayMs = Math.max(0, next2am.getTime() - Date.now());

  const syncOpts = {
    delay: delayMs,
    attempts: 3,
    backoff: { type: "exponential" as const, delay: 10_000 },
    // Stable jobId prevents duplicate scheduling if scheduleNextSync is
    // called multiple times for the same store on the same day
    jobId: `daily-${storeId}-${storeLocalDateStr(tz, tomorrow)}`
  };

  for (const conn of store.connections) {
    const token = decryptToken(conn.accessToken);
    const base = { storeId, timezone: tz };
    if (conn.provider === "SHOPIFY") {
      await syncQueue.add("shopify-sync",
        { ...base, provider: "SHOPIFY", shop: store.storeUrl, accessToken: token },
        { ...syncOpts, jobId: `daily-${storeId}-SHOPIFY-${storeLocalDateStr(tz, tomorrow)}` }
      );
    } else if (conn.provider === "WOOCOMMERCE") {
      await syncQueue.add("woocommerce-sync",
        { ...base, provider: "WOOCOMMERCE", storeUrl: store.storeUrl, accessToken: token },
        { ...syncOpts, jobId: `daily-${storeId}-WOO-${storeLocalDateStr(tz, tomorrow)}` }
      );
    } else if (conn.provider === "META") {
      await syncQueue.add("meta-sync",
        { ...base, provider: "META", accessToken: token,
          metaAdAccountId: conn.metaAdAccountId, metaCatalogId: conn.metaCatalogId },
        { ...syncOpts, jobId: `daily-${storeId}-META-${storeLocalDateStr(tz, tomorrow)}` }
      );
    }
  }

  const fireAt = next2am.toISOString();
  console.log(`[scheduler] Next sync for store ${storeId} scheduled at ${fireAt} (${tz} 2am, delay ${Math.round(delayMs / 60000)}min)`);
}

/**
 * Computes the UTC timestamp of 2:30 AM tomorrow in the given timezone,
 * then adds a delayed rollup job for the store.
 */
export async function scheduleNextRollup(storeId: string): Promise<void> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { timezone: true }
  });
  if (!store) return;

  const tz = store.timezone ?? "Africa/Lagos";
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86_400_000);
  const { start: tomorrowMidnight } = storeLocalDayBounds(tz, tomorrow);
  const next230 = new Date(tomorrowMidnight.getTime() + 2.5 * 60 * 60 * 1000);
  const delayMs = Math.max(0, next230.getTime() - Date.now());

  await rollupQueue.add(
    "rollup-store",
    { storeId },
    {
      delay: delayMs,
      attempts: 2,
      backoff: { type: "exponential", delay: 10_000 },
      jobId: `daily-rollup-${storeId}-${storeLocalDateStr(tz, tomorrow)}`
    }
  );

  const fireAt = next230.toISOString();
  console.log(`[scheduler] Next rollup for store ${storeId} scheduled at ${fireAt} (${tz} 2:30am, delay ${Math.round(delayMs / 60000)}min)`);
}

/**
 * Schedules the nightly retention job at 3:00 AM UTC (server time).
 * One global job — not per-store. Deduped by stable jobId.
 * Called once at worker startup to ensure a job is always queued.
 */
export async function scheduleNextRetention(): Promise<void> {
  const now = new Date();
  // Next 3:00 AM UTC
  const next3am = new Date(now);
  next3am.setUTCHours(3, 0, 0, 0);
  if (next3am <= now) next3am.setUTCDate(next3am.getUTCDate() + 1);
  const delayMs = next3am.getTime() - Date.now();

  const dateStr = next3am.toISOString().split("T")[0]; // e.g. "2026-03-21"
  await retentionQueue.add(
    "run-retention",
    {},
    {
      delay:    delayMs,
      attempts: 2,
      backoff:  { type: "exponential", delay: 30_000 },
      jobId:    `retention-${dateStr}` // deduped — only one per calendar day
    }
  );
  console.log(`[scheduler] Retention job scheduled for ${next3am.toISOString()} (in ${Math.round(delayMs / 60000)}min)`);
}

/**
 * Schedules the next weekly digest for Monday 8:00 AM UTC.
 * One global job — not per-store. Deduped by stable jobId (ISO week string).
 * Called once at worker startup and after each digest completes.
 */
export async function scheduleNextWeeklyDigest(): Promise<void> {
  const now = new Date();
  // Find next Monday
  const daysUntilMonday = (8 - now.getUTCDay()) % 7 || 7; // 0=Sun → 7 days, 1=Mon → 7 days if today is Mon (fire next week)
  const nextMonday = new Date(now);
  nextMonday.setUTCDate(now.getUTCDate() + daysUntilMonday);
  nextMonday.setUTCHours(8, 0, 0, 0);
  const delayMs = nextMonday.getTime() - Date.now();

  // ISO week identifier: "weekly-YYYY-Www" — deduped so only one job per week
  const weekStr = nextMonday.toISOString().slice(0, 10); // e.g. "2026-03-23"
  await weeklyQueue.add(
    "run-weekly-digest",
    {},
    {
      delay:    delayMs,
      attempts: 2,
      backoff:  { type: "exponential", delay: 60_000 },
      jobId:    `weekly-digest-${weekStr}`
    }
  );
  console.log(`[scheduler] Weekly digest scheduled for ${nextMonday.toISOString()} (in ${Math.round(delayMs / 60000)}min)`);
}

// Bootstrap: ensure retention and weekly digest are scheduled on worker startup
scheduleNextRetention().catch((err) => {
  console.error("[scheduler] Failed to schedule retention:", err);
});
scheduleNextWeeklyDigest().catch((err) => {
  console.error("[scheduler] Failed to schedule weekly digest:", err);
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown() {
  console.log("[worker] Shutting down...");
  await syncWorker.close();
  await scoringWorker.close();
  await rollupWorker.close();
  await retentionWorker.close();
  await weeklyWorker.close();
  await syncQueue.close();
  await rollupQueue.close();
  await retentionQueue.close();
  await scoringQueue.close();
  await weeklyQueue.close();
  await prisma.$disconnect();
  await connection.quit();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// ─── Worker event listeners ───────────────────────────────────────────────────
syncWorker.on("completed", (job) => {
  console.log(`[sync] Job ${job.id} completed`);
});

syncWorker.on("failed", (job, err) => {
  console.error(`[sync] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
  Sentry.captureException(err, { extra: { jobId: job?.id, jobData: job?.data, queue: "sync" } });
});

scoringWorker.on("completed", (job) => {
  console.log(`[scoring] Job ${job.id} completed`);
});

scoringWorker.on("failed", (job, err) => {
  console.error(`[scoring] Job ${job?.id} failed:`, err.message);
  Sentry.captureException(err, { extra: { jobId: job?.id, jobData: job?.data, queue: "scoring" } });
});

rollupWorker.on("completed", (job) => {
  console.log(`[rollup] Job ${job.id} completed`);
});

rollupWorker.on("failed", (job, err) => {
  console.error(`[rollup] Job ${job?.id} failed:`, err.message);
  Sentry.captureException(err, { extra: { jobId: job?.id, jobData: job?.data, queue: "rollup" } });
});

retentionWorker.on("completed", async (job) => {
  console.log(`[retention] Job ${job.id} completed`);
  // Re-schedule for tomorrow
  await scheduleNextRetention().catch(console.error);
});

retentionWorker.on("failed", (job, err) => {
  console.error(`[retention] Job ${job?.id} failed:`, err.message);
  Sentry.captureException(err, { extra: { jobId: job?.id, queue: "retention" } });
});

weeklyWorker.on("completed", async (job) => {
  console.log(`[weekly] Job ${job.id} completed`);
  // Re-schedule for next Monday
  await scheduleNextWeeklyDigest().catch(console.error);
});

weeklyWorker.on("failed", (job, err) => {
  console.error(`[weekly] Job ${job?.id} failed:`, err.message);
  Sentry.captureException(err, { extra: { jobId: job?.id, queue: "weekly" } });
});

console.log("[worker] MetaFlow worker started — listening for jobs...");
console.log("[worker] Self-scheduling syncs active — each store chains its next 2am sync on completion");
console.log("[worker] Weekly digest scheduler active — fires every Monday 8:00 AM UTC");
