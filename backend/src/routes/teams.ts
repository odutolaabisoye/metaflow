import type { FastifyInstance } from "fastify";
import crypto from "crypto";

export async function teamRoutes(app: FastifyInstance) {
  // GET /teams/:storeId/members — list team members and pending invites
  app.get("/teams/:storeId/members", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      const { storeId } = request.params as { storeId: string };

      // Check store ownership
      const store = await app.prisma.store.findFirst({
        where: { id: storeId, ownerId: payload.sub }
      });
      if (!store) return reply.code(403).send({ ok: false, message: "Access denied" });

      const [members, invites] = await Promise.all([
        app.prisma.teamMember.findMany({
          where: { storeId },
          include: { user: { select: { id: true, email: true, name: true } } },
          orderBy: { joinedAt: "asc" }
        }),
        app.prisma.teamInvite.findMany({
          where: { storeId, acceptedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" }
        })
      ]);

      return reply.send({ ok: true, members, invites });
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });

  // POST /teams/:storeId/invite — invite a user by email
  app.post("/teams/:storeId/invite", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      const { storeId } = request.params as { storeId: string };
      const { email } = (request.body ?? {}) as { email?: string };

      if (!email?.trim()) {
        return reply.code(400).send({ ok: false, message: "Email is required" });
      }

      const store = await app.prisma.store.findFirst({
        where: { id: storeId, ownerId: payload.sub }
      });
      if (!store) return reply.code(403).send({ ok: false, message: "Access denied" });

      // Check if already a member
      const inviteeUser = await app.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
      if (inviteeUser) {
        const existingMember = await app.prisma.teamMember.findFirst({
          where: { storeId, userId: inviteeUser.id }
        });
        if (existingMember) {
          return reply.code(409).send({ ok: false, message: "User is already a team member" });
        }
      }

      // Check for existing pending invite
      const existingInvite = await app.prisma.teamInvite.findFirst({
        where: { storeId, email: email.trim().toLowerCase(), acceptedAt: null, expiresAt: { gt: new Date() } }
      });
      if (existingInvite) {
        return reply.code(409).send({ ok: false, message: "Invite already pending for this email" });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const invite = await app.prisma.teamInvite.create({
        data: {
          email: email.trim().toLowerCase(),
          storeId,
          invitedBy: payload.sub,
          token,
          expiresAt
        }
      });

      // Send invite email (non-blocking)
      const inviter = await app.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { email: true, name: true }
      });
      if (inviter) {
        app.mail.sendTeamInvite(
          email.trim().toLowerCase(),
          inviter.name ?? inviter.email,
          store.name,
          token
        ).catch((err: any) => app.log.error({ err }, "Failed to send team invite email"));
      }

      return reply.code(201).send({ ok: true, invite });
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });

  // POST /teams/accept/:token — accept a team invite
  app.post("/teams/accept/:token", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      const { token } = request.params as { token: string };

      const invite = await app.prisma.teamInvite.findUnique({ where: { token } });
      if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
        return reply.code(400).send({ ok: false, message: "Invalid or expired invite" });
      }

      const user = await app.prisma.user.findUnique({ where: { id: payload.sub }, select: { email: true } });
      if (!user || user.email !== invite.email) {
        return reply.code(403).send({ ok: false, message: "This invite was sent to a different email address" });
      }

      await app.prisma.$transaction([
        app.prisma.teamInvite.update({ where: { token }, data: { acceptedAt: new Date() } }),
        app.prisma.teamMember.create({ data: { userId: payload.sub, storeId: invite.storeId } })
      ]);

      return reply.send({ ok: true, storeId: invite.storeId });
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });

  // DELETE /teams/:storeId/members/:userId — remove a team member
  app.delete("/teams/:storeId/members/:userId", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      const { storeId, userId } = request.params as { storeId: string; userId: string };

      const store = await app.prisma.store.findFirst({
        where: { id: storeId, ownerId: payload.sub }
      });
      if (!store) return reply.code(403).send({ ok: false, message: "Access denied" });

      await app.prisma.teamMember.deleteMany({ where: { storeId, userId } });
      return reply.send({ ok: true });
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });

  // DELETE /teams/:storeId/invites/:inviteId — revoke a pending invite
  app.delete("/teams/:storeId/invites/:inviteId", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      const { storeId, inviteId } = request.params as { storeId: string; inviteId: string };

      const store = await app.prisma.store.findFirst({
        where: { id: storeId, ownerId: payload.sub }
      });
      if (!store) return reply.code(403).send({ ok: false, message: "Access denied" });

      await app.prisma.teamInvite.deleteMany({ where: { id: inviteId, storeId } });
      return reply.send({ ok: true });
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });
}
