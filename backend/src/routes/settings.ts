import type { FastifyInstance } from "fastify";

// ─── Shape of the settings object sent to the client ─────────────────────────
function formatSettings(s: {
  ruleScale: boolean; ruleTest: boolean; ruleKill: boolean; ruleInventory: boolean;
  thresholdScale: number; thresholdTest: number; thresholdKill: number;
  benchmarkRoas: number; benchmarkCtr: number; benchmarkMargin: number; benchmarkInventory: number;
  notifEmailReports: boolean; notifWhatsapp: boolean; notifWeeklyDigest: boolean;
}) {
  return {
    rules: {
      scale:     s.ruleScale,
      test:      s.ruleTest,
      kill:      s.ruleKill,
      inventory: s.ruleInventory,
    },
    thresholds: {
      scale: s.thresholdScale,
      test:  s.thresholdTest,
      kill:  s.thresholdKill,
    },
    benchmarks: {
      roas:      s.benchmarkRoas,
      ctr:       s.benchmarkCtr,
      margin:    s.benchmarkMargin,
      inventory: s.benchmarkInventory,
    },
    notifications: {
      emailReports:   s.notifEmailReports,
      whatsappAlerts: s.notifWhatsapp,
      weeklyDigest:   s.notifWeeklyDigest,
    },
  };
}

export async function settingsRoutes(app: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════════════════════
  // GET /settings
  // Returns the user's settings, creating a default row if none exists yet.
  // ═══════════════════════════════════════════════════════════════════════════
  app.get("/settings", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      if (!payload?.sub) return reply.code(401).send({ ok: false, message: "Unauthorized" });

      const settings = await app.prisma.userSettings.upsert({
        where:  { userId: payload.sub },
        update: {},
        create: { userId: payload.sub },
      });

      return reply.send({ ok: true, settings: formatSettings(settings) });
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PATCH /settings
  // Partial update — only fields present in the body are changed.
  // ═══════════════════════════════════════════════════════════════════════════
  app.patch("/settings", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      if (!payload?.sub) return reply.code(401).send({ ok: false, message: "Unauthorized" });
      const body = request.body as {
        rules?: {
          scale?: boolean;
          test?: boolean;
          kill?: boolean;
          inventory?: boolean;
        };
        thresholds?: {
          scale?: number;
          test?: number;
          kill?: number;
        };
        benchmarks?: {
          roas?: number;
          ctr?: number;
          margin?: number;
          inventory?: number;
        };
        notifications?: {
          emailReports?: boolean;
          whatsappAlerts?: boolean;
          weeklyDigest?: boolean;
        };
      };

      const data: Record<string, unknown> = {};

      if (body.rules) {
        if (body.rules.scale     !== undefined) data.ruleScale     = body.rules.scale;
        if (body.rules.test      !== undefined) data.ruleTest      = body.rules.test;
        if (body.rules.kill      !== undefined) data.ruleKill      = body.rules.kill;
        if (body.rules.inventory !== undefined) data.ruleInventory = body.rules.inventory;
      }

      if (body.thresholds) {
        // Guard against NaN/Infinity which would pass through Math.min/max unchanged and corrupt the DB
        const clamp = (v: number) => !Number.isFinite(v) ? 0 : Math.min(100, Math.max(0, Math.round(v)));
        if (body.thresholds.scale !== undefined) data.thresholdScale = clamp(body.thresholds.scale);
        if (body.thresholds.test  !== undefined) data.thresholdTest  = clamp(body.thresholds.test);
        if (body.thresholds.kill  !== undefined) data.thresholdKill  = clamp(body.thresholds.kill);
      }

      if (body.benchmarks) {
        // Guard against NaN/Infinity — Math.max(0.001, NaN) === NaN, which would be written to DB
        const clampPositive = (v: number) => !Number.isFinite(v) ? 0.001 : Math.max(0.001, v);
        if (body.benchmarks.roas      !== undefined) data.benchmarkRoas      = clampPositive(body.benchmarks.roas);
        if (body.benchmarks.ctr       !== undefined) data.benchmarkCtr       = Math.min(1, clampPositive(body.benchmarks.ctr / 100)); // accept as % like "3" → store as 0.03
        if (body.benchmarks.margin    !== undefined) data.benchmarkMargin    = Math.min(1, clampPositive(body.benchmarks.margin / 100)); // accept as % like "50" → 0.5
        if (body.benchmarks.inventory !== undefined) data.benchmarkInventory = !Number.isFinite(body.benchmarks.inventory) ? 1 : Math.max(1, Math.round(body.benchmarks.inventory));
      }

      if (body.notifications) {
        if (body.notifications.emailReports   !== undefined) data.notifEmailReports = body.notifications.emailReports;
        if (body.notifications.whatsappAlerts !== undefined) data.notifWhatsapp     = body.notifications.whatsappAlerts;
        if (body.notifications.weeklyDigest   !== undefined) data.notifWeeklyDigest = body.notifications.weeklyDigest;
      }

      const settings = await app.prisma.userSettings.upsert({
        where:  { userId: payload.sub },
        update: data,
        create: { userId: payload.sub, ...data },
      });

      // Write audit log for scoring/benchmark/threshold changes on all user stores,
      // then re-trigger the scoring job so products are re-scored with the new benchmarks.
      const hasScoringChange = body.benchmarks || body.thresholds;
      if (hasScoringChange && Object.keys(data).length > 0) {
        const userStores = await app.prisma.store.findMany({
          where: { ownerId: payload.sub },
          select: { id: true }
        });
        await Promise.all(
          userStores.map((s: { id: string }) =>
            app.prisma.auditLog.create({
              data: {
                storeId: s.id,
                action:  "settings.updated",
                detail:  `User updated global settings: ${Object.keys(data).join(", ")}`,
                metadata: { updates: data },
              }
            }).catch((err: Error) =>
              app.log.warn({ err, storeId: s.id }, "[settings] Audit log write failed — non-fatal")
            )
          )
        );

        // Re-score each store immediately so the new benchmarks/thresholds are reflected
        // without waiting for the next scheduled scoring run.
        if (app.queues?.scoringQueue) {
          await Promise.all(
            userStores.map((s: { id: string }) =>
              app.queues.scoringQueue
                .add("score-store", { storeId: s.id }, { attempts: 2, backoff: { type: "fixed", delay: 5000 } })
                .catch((err: Error) =>
                  app.log.warn({ err, storeId: s.id }, "[settings] Failed to enqueue re-score job — non-fatal")
                )
            )
          );
        }
      }

      return reply.send({ ok: true, settings: formatSettings(settings) });
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PATCH /settings/plan
  // Self-serve plan change. Downgrades apply immediately; cancellations are
  // acknowledged (admin processes billing manually). Upgrades are rejected
  // so the frontend can direct the user to contact support.
  // ═══════════════════════════════════════════════════════════════════════════
  app.patch("/settings/plan", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      if (!payload?.sub) return reply.code(401).send({ ok: false, message: "Unauthorized" });
      const { plan: newPlan } = (request.body ?? {}) as { plan?: string };

      if (!newPlan) {
        return reply.code(400).send({ ok: false, message: "plan is required" });
      }

      const user = await app.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) return reply.code(404).send({ ok: false, message: "User not found" });

      // Cancellation — acknowledge without touching the plan (admin handles billing)
      if (newPlan.toUpperCase() === "CANCEL") {
        return reply.send({ ok: true, action: "cancel_requested", plan: user.plan });
      }

      const PLAN_ORDER = ["STARTER", "GROWTH", "SCALE"];
      const currentIdx = PLAN_ORDER.indexOf(user.plan);
      const newIdx     = PLAN_ORDER.indexOf(newPlan.toUpperCase());

      if (newIdx === -1) {
        return reply.code(400).send({ ok: false, message: "Invalid plan" });
      }

      if (newIdx >= currentIdx) {
        return reply.code(402).send({ ok: false, message: "Upgrades require payment — contact hello@metaflow.io" });
      }

      const updated = await app.prisma.user.update({
        where: { id: payload.sub },
        data:  { plan: newPlan.toUpperCase() as any },
      });

      return reply.send({ ok: true, action: "downgraded", plan: updated.plan });
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /settings/store/:storeId — get effective benchmarks for a store
  // (merged: store overrides take precedence over user defaults)
  // ═══════════════════════════════════════════════════════════════════════════
  app.get("/settings/store/:storeId", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      if (!payload?.sub) return reply.code(401).send({ ok: false, message: "Unauthorized" });
      const { storeId } = request.params as { storeId: string };

      // Verify ownership
      const store = await app.prisma.store.findFirst({
        where: { id: storeId, ownerId: payload.sub },
        select: { benchmarkRoas: true, benchmarkCtr: true, benchmarkMargin: true, benchmarkInventory: true }
      });
      if (!store) return reply.code(403).send({ ok: false, message: "Forbidden" });

      // Get user defaults
      const userSettings = await app.prisma.userSettings.findUnique({
        where: { userId: payload.sub },
        select: { benchmarkRoas: true, benchmarkCtr: true, benchmarkMargin: true, benchmarkInventory: true }
      });

      return reply.send({
        ok: true,
        storeBenchmarks: {
          roas:      store.benchmarkRoas      ?? null,
          ctr:       store.benchmarkCtr       != null ? store.benchmarkCtr * 100 : null,   // stored as decimal, return as %
          margin:    store.benchmarkMargin    != null ? store.benchmarkMargin * 100 : null, // stored as decimal, return as %
          inventory: store.benchmarkInventory ?? null,
        },
        effectiveBenchmarks: {
          roas:      store.benchmarkRoas      ?? userSettings?.benchmarkRoas      ?? 5,
          ctr:       (store.benchmarkCtr      ?? userSettings?.benchmarkCtr       ?? 0.03) * 100,
          margin:    (store.benchmarkMargin   ?? userSettings?.benchmarkMargin    ?? 0.5) * 100,
          inventory: store.benchmarkInventory ?? userSettings?.benchmarkInventory ?? 10,
        }
      });
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PATCH /settings/store/:storeId — update store-level benchmark overrides
  // Send null for a field to clear its override (fall back to user-level default)
  // ═══════════════════════════════════════════════════════════════════════════
  app.patch("/settings/store/:storeId", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      if (!payload?.sub) return reply.code(401).send({ ok: false, message: "Unauthorized" });
      const { storeId } = request.params as { storeId: string };

      // Verify ownership
      const existing = await app.prisma.store.findFirst({
        where: { id: storeId, ownerId: payload.sub }
      });
      if (!existing) return reply.code(403).send({ ok: false, message: "Forbidden" });

      const body = request.body as {
        roas?:      number | null;
        ctr?:       number | null;   // sent as % (e.g. 3 = 3%), stored as decimal (0.03)
        margin?:    number | null;   // sent as % (e.g. 50 = 50%), stored as decimal (0.5)
        inventory?: number | null;
      };

      // Guard: NaN/Infinity from malformed JSON would pass through Math.max/min unchanged.
      // fin(v, fb) returns v when it's a finite number, fb otherwise (null stays null).
      const fin = (v: number | null | undefined, fb: number): number =>
        (v != null && Number.isFinite(v)) ? v : fb;

      const data: Record<string, unknown> = {};
      if (body.roas      !== undefined) data.benchmarkRoas      = body.roas      != null ? Math.max(0.1,  fin(body.roas,      0.1))                            : null;
      if (body.ctr       !== undefined) data.benchmarkCtr       = body.ctr       != null ? Math.min(1, Math.max(0.001, fin(body.ctr,       3) / 100))          : null;
      if (body.margin    !== undefined) data.benchmarkMargin    = body.margin    != null ? Math.min(1, Math.max(0.001, fin(body.margin,    50) / 100))          : null;
      if (body.inventory !== undefined) data.benchmarkInventory = body.inventory != null ? Math.max(1, Math.round(fin(body.inventory, 10)))                    : null;

      const updated = await app.prisma.store.update({
        where: { id: storeId },
        data,
        select: { benchmarkRoas: true, benchmarkCtr: true, benchmarkMargin: true, benchmarkInventory: true }
      });

      if (Object.keys(data).length > 0) {
        await app.prisma.auditLog.create({
          data: {
            storeId,
            action: "store.benchmarks.updated",
            detail: `Updated store benchmark overrides: ${Object.keys(data).join(", ")}`,
            metadata: { updates: data },
          }
        }).catch((err: Error) =>
          app.log.warn({ err, storeId }, "[settings] Audit log write failed — non-fatal")
        );
      }

      return reply.send({
        ok: true,
        storeBenchmarks: {
          roas:      updated.benchmarkRoas      ?? null,
          ctr:       updated.benchmarkCtr       != null ? updated.benchmarkCtr * 100 : null,
          margin:    updated.benchmarkMargin    != null ? updated.benchmarkMargin * 100 : null,
          inventory: updated.benchmarkInventory ?? null,
        }
      });
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DELETE /settings (reset to defaults)
  // Deletes the settings row — next GET will recreate with defaults.
  // ═══════════════════════════════════════════════════════════════════════════
  app.delete("/settings", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      if (!payload?.sub) return reply.code(401).send({ ok: false, message: "Unauthorized" });

      await app.prisma.userSettings.deleteMany({
        where: { userId: payload.sub },
      });

      return reply.send({ ok: true });
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });
}
