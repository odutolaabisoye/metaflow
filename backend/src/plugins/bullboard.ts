/**
 * Bull Board Plugin
 * ─────────────────────────────────────────────────────────────────────────────
 * Mounts the Bull Board job queue UI at /admin/queues.
 * Protected by JWT admin-role check — only ADMIN users can access.
 *
 * The plugin creates lightweight Queue instances (no Workers) that connect to
 * the same Redis queues used by the worker process — purely for monitoring.
 *
 * Usage: open /admin/queues in browser after logging in as ADMIN.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import fp from "fastify-plugin";
import { Queue } from "bullmq";
import { createBullBoard } from "@bull-board/api";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { BullMQAdapter } = require("@bull-board/api/bullMQAdapter");
import { FastifyAdapter } from "@bull-board/fastify";

const BULL_BOARD_PREFIX = "/admin/queues";

async function bullBoardPlugin(app: any) {
  // Skip if no Redis is configured (e.g. test environment)
  if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
    app.log.warn("[bull-board] No Redis URL — skipping Bull Board setup");
    return;
  }

  const redisOpts = {
    connection: {
      url: process.env.REDIS_URL ?? `redis://${process.env.REDIS_HOST ?? "localhost"}:${process.env.REDIS_PORT ?? 6379}`
    }
  };

  // Read-only Queue instances for monitoring — no Workers
  const syncQueue      = new Queue("sync",      redisOpts);
  const scoringQueue   = new Queue("scoring",   redisOpts);
  const rollupQueue    = new Queue("rollup",    redisOpts);
  const retentionQueue = new Queue("retention", redisOpts);

  const serverAdapter = new FastifyAdapter();

  createBullBoard({
    queues: [
      new BullMQAdapter(syncQueue),
      new BullMQAdapter(scoringQueue),
      new BullMQAdapter(rollupQueue),
      new BullMQAdapter(retentionQueue),
    ],
    serverAdapter
  });

  serverAdapter.setBasePath(BULL_BOARD_PREFIX);

  // Admin-only preHandler guard
  async function requireAdmin(request: any, reply: any) {
    try {
      const payload = await (request as any).jwtVerify() as { role: string };
      if (payload.role !== "ADMIN") {
        return reply.code(403).send({ ok: false, message: "Admin only" });
      }
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  }

  await app.register(serverAdapter.registerPlugin(), {
    prefix: BULL_BOARD_PREFIX,
    basePath: BULL_BOARD_PREFIX,
    // Add admin check to every Bull Board route
    preHandler: requireAdmin
  });

  // Clean up queue connections on server close
  app.addHook("onClose", async () => {
    await Promise.allSettled([
      syncQueue.close(),
      scoringQueue.close(),
      rollupQueue.close(),
      retentionQueue.close(),
    ]);
  });

  app.log.info(`[bull-board] Queue monitor available at ${BULL_BOARD_PREFIX}`);
}

export default fp(bullBoardPlugin, {
  name: "bull-board",
  dependencies: ["env"]
});
