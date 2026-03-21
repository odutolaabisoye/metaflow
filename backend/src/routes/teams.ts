import type { FastifyInstance } from "fastify";
import crypto from "crypto";
import { hashToken } from "../utils/crypto.js";

export async function teamRoutes(app: FastifyInstance) {
  // GET /teams/:storeId/members — list team members and pending invites
  app.get("/teams/:storeId/members", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      if (!payload?.sub) return reply.code(401).send({ ok: false, message: "Unauthorized" });
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
      if (!payload?.sub) return reply.code(401).send({ ok: false, message: "Unauthorized" });
      const { storeId } = request.params as { storeId: string };
      const { email } = (request.body ?? {}) as { email?: string };

      if (!email?.trim()) {
        return reply.code(400).send({ ok: false, message: "Email is required" });
      }

      // Basic email format guard — prevents inviting garbage strings
      const normalizedEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return reply.code(400).send({ ok: false, message: "Invalid email address" });
      }

      const store = await app.prisma.store.findFirst({
        where: { id: storeId, ownerId: payload.sub }
      });
      if (!store) return reply.code(403).send({ ok: false, message: "Access denied" });

      // Check if already a member
      const inviteeUser = await app.prisma.user.findUnique({ where: { email: normalizedEmail } });
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
        where: { storeId, email: normalizedEmail, acceptedAt: null, expiresAt: { gt: new Date() } }
      });
      if (existingInvite) {
        return reply.code(409).send({ ok: false, message: "Invite already pending for this email" });
      }

      const tokenPlain = crypto.randomBytes(32).toString("hex");
      const tokenHash  = hashToken(tokenPlain);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const invite = await app.prisma.teamInvite.create({
        data: {
          email: normalizedEmail,
          storeId,
          invitedBy: payload.sub,
          token: tokenHash,
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
          normalizedEmail,
          inviter.name ?? inviter.email,
          store.name,
          tokenPlain
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
      if (!payload?.sub) return reply.code(401).send({ ok: false, message: "Unauthorized" });
      const { token } = request.params as { token: string };

      const tokenHash = hashToken(token);
      let invite = await app.prisma.teamInvite.findUnique({ where: { token: tokenHash } });
      // Legacy fallback: plaintext stored in DB — accept once and rotate to hashed
      if (!invite) {
        const legacy = await app.prisma.teamInvite.findUnique({ where: { token } });
        if (legacy && !legacy.acceptedAt && legacy.expiresAt >= new Date()) {
          invite = await app.prisma.teamInvite.update({
            where: { token },
            data:  { token: tokenHash }
          });
        }
      }
      if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
        return reply.code(400).send({ ok: false, message: "Invalid or expired invite" });
      }

      const user = await app.prisma.user.findUnique({ where: { id: payload.sub }, select: { email: true } });
      if (!user || user.email !== invite.email) {
        return reply.code(403).send({ ok: false, message: "This invite was sent to a different email address" });
      }

      // Atomic accept: updateMany with acceptedAt: null guard prevents double-accept
      // race and uses the correct tokenHash (not the plaintext URL param).
      try {
        await app.prisma.$transaction(async (tx) => {
          const updated = await tx.teamInvite.updateMany({
            where: { token: tokenHash, acceptedAt: null, expiresAt: { gte: new Date() } },
            data: { acceptedAt: new Date() }
          });
          if (updated.count === 0) throw new Error("ALREADY_ACCEPTED");
          await tx.teamMember.create({ data: { userId: payload.sub, storeId: invite.storeId } });
        });
      } catch (txErr: any) {
        if (txErr?.message === "ALREADY_ACCEPTED") {
          return reply.code(409).send({ ok: false, message: "Invite has already been accepted" });
        }
        throw txErr;
      }

      return reply.send({ ok: true, storeId: invite.storeId });
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });

  // DELETE /teams/:storeId/members/:userId — remove a team member
  app.delete("/teams/:storeId/members/:userId", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      if (!payload?.sub) return reply.code(401).send({ ok: false, message: "Unauthorized" });
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
      if (!payload?.sub) return reply.code(401).send({ ok: false, message: "Unauthorized" });
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
