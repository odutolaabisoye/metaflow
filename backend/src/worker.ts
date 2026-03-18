/**
 * MetaFlow Background Worker
 *
 * Processes jobs from two BullMQ queues:
 *   - "sync"    — platform data sync (Shopify, WooCommerce, Meta Ads)
 *   - "scoring" — product scoring engine
 *
 * Run this process independently from the API server:
 *   node --loader ts-node/esm src/worker.ts
 */
import { Worker } from "bullmq";
import Redis from "ioredis";
import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";
import { runScoringJob } from "./jobs/scoring.js";
import { runShopifySync } from "./jobs/syncShopify.js";
import { runWooCommerceSync } from "./jobs/syncWooCommerce.js";
import { runMetaSync } from "./jobs/syncMeta.js";

// ─── Connections ──────────────────────────────────────────────────────────────
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null
});

const prisma = new PrismaClient();

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
      switch (provider) {
        case "SHOPIFY": {
          const { shop, accessToken } = job.data as { shop: string; accessToken: string };
          const result = await runShopifySync(prisma, { storeId, shop, accessToken });
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
          return result;
        }

        case "WOOCOMMERCE": {
          const { storeUrl, accessToken } = job.data as { storeUrl: string; accessToken: string };
          const result = await runWooCommerceSync(prisma, { storeId, storeUrl, accessToken });
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
          return result;
        }

        case "META": {
          const { accessToken, metaAdAccountId, metaCatalogId } = job.data as {
            accessToken: string;
            metaAdAccountId?: string | null;
            metaCatalogId?: string | null;
          };
          const result = await runMetaSync(prisma, { storeId, accessToken, metaAdAccountId, metaCatalogId });
          console.log(
            `[sync] Meta complete — ${result.adAccounts} accounts, ${result.insightsMatched} insights matched`
          );

          await prisma.auditLog.create({
            data: {
              action: "Meta Ads Synced",
              detail: `Matched ${result.insightsMatched} ad insights across ${result.adAccounts} ad accounts`,
              metadata: { provider: "META", ...result, variant: "default", tag: "Info" },
              storeId
            }
          });
          await prisma.store.update({
            where: { id: storeId },
            data: { lastSyncStatus: "SUCCESS", lastSyncAt: new Date() }
          }).catch(() => {});
          return result;
        }

        default:
          throw new Error(`Unknown sync provider: ${provider}`);
      }
    } catch (err) {
      console.error(`[sync] Job ${job.id} failed:`, err);
      // Record error but don't let this secondary update swallow the original error
      await prisma.store.update({
        where: { id: storeId },
        data: {
          lastSyncStatus: "ERROR",
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

// ─── Scheduled jobs (daily cron-style) ───────────────────────────────────────
// These are triggered by the queue plugin's repeatable jobs.
// To schedule daily syncs, add to your startup script:
//   await syncQueue.add("daily-sync", { provider: "ALL" }, { repeat: { cron: "0 6 * * *" } });

// ─── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown() {
  console.log("[worker] Shutting down...");
  await syncWorker.close();
  await scoringWorker.close();
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
});

scoringWorker.on("completed", (job) => {
  console.log(`[scoring] Job ${job.id} completed`);
});

scoringWorker.on("failed", (job, err) => {
  console.error(`[scoring] Job ${job?.id} failed:`, err.message);
});

console.log("[worker] MetaFlow worker started — listening for jobs...");
