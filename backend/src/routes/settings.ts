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
