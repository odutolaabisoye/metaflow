import type { FastifyInstance } from "fastify";

// ─── Shape of the settings object sent to the client ─────────────────────────
function formatSettings(s: {
  ruleScale: boolean; ruleTest: boolean; ruleKill: boolean; ruleInventory: boolean;
  thresholdScale: number; thresholdTest: number; thresholdKill: number;
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
        const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v)));
        if (body.thresholds.scale !== undefined) data.thresholdScale = clamp(body.thresholds.scale);
        if (body.thresholds.test  !== undefined) data.thresholdTest  = clamp(body.thresholds.test);
        if (body.thresholds.kill  !== undefined) data.thresholdKill  = clamp(body.thresholds.kill);
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
  // DELETE /settings (reset to defaults)
  // Deletes the settings row — next GET will recreate with defaults.
  // ═══════════════════════════════════════════════════════════════════════════
  app.delete("/settings", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();

      await app.prisma.userSettings.deleteMany({
        where: { userId: payload.sub },
      });

      return reply.send({ ok: true });
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });
}
