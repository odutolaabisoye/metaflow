import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/"
};

// Non-httpOnly presence cookie — readable by JS/Nuxt middleware to detect login state.
// The actual JWT stays in mf_session (httpOnly) for security.
const AUTH_FLAG_OPTIONS = {
  httpOnly: false,
  sameSite: "lax" as const,
  path: "/"
};

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/signup", async (request, reply) => {
    const body = request.body as { email?: string; password?: string; name?: string };
    const email = body?.email?.trim().toLowerCase();
    const password = body?.password?.trim();

    if (!email || !password) {
      return reply.code(400).send({ ok: false, message: "Email and password are required" });
    }

    const existing = await app.prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(409).send({ ok: false, message: "User already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await app.prisma.user.create({
      data: {
        email,
        name: body?.name?.trim() || null,
        passwordHash
      }
    });

    // Send welcome email (non-blocking — don't fail signup if mail fails)
    app.mail.sendWelcome(user.email, user.name ?? "").catch((err) =>
      app.log.error({ err }, "Failed to send welcome email")
    );

    const token = app.jwt.sign({ sub: user.id, email: user.email });
    const maxAge = 60 * 60 * 24 * 7;
    reply.setCookie("mf_session", token, {
      ...COOKIE_OPTIONS,
      secure: process.env.NODE_ENV === "production",
      maxAge
    });
    reply.setCookie("mf_auth", "1", {
      ...AUTH_FLAG_OPTIONS,
      secure: process.env.NODE_ENV === "production",
      maxAge
    });

    return reply.send({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
  });

  app.post("/auth/login", async (request, reply) => {
    const body = request.body as { email?: string; password?: string };
    const email = body?.email?.trim().toLowerCase();
    const password = body?.password?.trim();

    if (!email || !password) {
      return reply.code(400).send({ ok: false, message: "Email and password are required" });
    }

    const user = await app.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.code(401).send({ ok: false, message: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return reply.code(401).send({ ok: false, message: "Invalid credentials" });
    }

    const token = app.jwt.sign({ sub: user.id, email: user.email });
    const maxAge = 60 * 60 * 24 * 7;
    reply.setCookie("mf_session", token, {
      ...COOKIE_OPTIONS,
      secure: process.env.NODE_ENV === "production",
      maxAge
    });
    reply.setCookie("mf_auth", "1", {
      ...AUTH_FLAG_OPTIONS,
      secure: process.env.NODE_ENV === "production",
      maxAge
    });

    return reply.send({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
  });

  app.post("/auth/logout", async (_request, reply) => {
    reply.clearCookie("mf_session", COOKIE_OPTIONS);
    reply.clearCookie("mf_auth", AUTH_FLAG_OPTIONS);
    return reply.send({ ok: true });
  });

  app.get("/auth/me", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      const user = await app.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, name: true, createdAt: true }
      });

      if (!user) {
        return reply.code(404).send({ ok: false, message: "User not found" });
      }

      return reply.send({ ok: true, user });
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });

  app.post("/auth/forgot", async (request, reply) => {
    const body = request.body as { email?: string };
    const email = body?.email?.trim().toLowerCase();

    if (!email) {
      return reply.code(400).send({ ok: false, message: "Email is required" });
    }

    const user = await app.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.send({ ok: true });
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

    await app.prisma.passwordResetToken.create({
      data: {
        token,
        expiresAt,
        userId: user.id
      }
    });

    await app.mail.sendPasswordReset(email, token);

    return reply.send({ ok: true });
  });

  app.post("/auth/reset", async (request, reply) => {
    const body = request.body as { token?: string; password?: string };
    const token = body?.token?.trim();
    const password = body?.password?.trim();

    if (!token || !password) {
      return reply.code(400).send({ ok: false, message: "Token and password are required" });
    }

    const record = await app.prisma.passwordResetToken.findUnique({ where: { token } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return reply.code(400).send({ ok: false, message: "Invalid or expired token" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await app.prisma.$transaction([
      app.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash }
      }),
      app.prisma.passwordResetToken.update({
        where: { token },
        data: { usedAt: new Date() }
      })
    ]);

    return reply.send({ ok: true });
  });
}
