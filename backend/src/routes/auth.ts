import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// In production the frontend (Netlify) and API (Hetzner) are on different origins.
// Cookies must use SameSite=none + Secure so the browser sends them cross-origin.
// In development we use SameSite=lax so it works without HTTPS.
const isProd = process.env.NODE_ENV === "production";
const SAME_SITE = isProd ? ("none" as const) : ("lax" as const);

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: SAME_SITE,
  secure: isProd,
  path: "/"
};

// Non-httpOnly presence cookie — readable by JS/Nuxt middleware to detect login state.
// The actual JWT stays in mf_session (httpOnly) for security.
const AUTH_FLAG_OPTIONS = {
  httpOnly: false,
  sameSite: SAME_SITE,
  secure: isProd,
  path: "/"
};

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/signup", { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
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

    const token = app.jwt.sign({ sub: user.id, email: user.email, role: user.role });
    const maxAge = 60 * 60 * 24 * 7;
    reply.setCookie("mf_session", token, { ...COOKIE_OPTIONS, maxAge });
    reply.setCookie("mf_auth", "1", { ...AUTH_FLAG_OPTIONS, maxAge });
    // Plan cookie — readable by JS/Nuxt middleware for feature gating
    reply.setCookie("mf_plan", user.plan, { ...AUTH_FLAG_OPTIONS, maxAge });

    return reply.send({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role, plan: user.plan } });
  });

  app.post("/auth/login", { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
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

    const token = app.jwt.sign({ sub: user.id, email: user.email, role: user.role });
    const maxAge = 60 * 60 * 24 * 7;
    reply.setCookie("mf_session", token, { ...COOKIE_OPTIONS, maxAge });
    reply.setCookie("mf_auth", "1", { ...AUTH_FLAG_OPTIONS, maxAge });
    // Set the non-httpOnly role flag so the frontend middleware can fast-path admin routes
    if (user.role === "ADMIN") {
      reply.setCookie("mf_role", "ADMIN", { ...AUTH_FLAG_OPTIONS, maxAge });
    }
    // Plan cookie — readable by JS/Nuxt middleware for feature gating
    reply.setCookie("mf_plan", user.plan, { ...AUTH_FLAG_OPTIONS, maxAge });

    return reply.send({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role, plan: user.plan } });
  });

  app.post("/auth/logout", async (_request, reply) => {
    reply.clearCookie("mf_session", COOKIE_OPTIONS);
    reply.clearCookie("mf_auth", AUTH_FLAG_OPTIONS);
    reply.clearCookie("mf_role", AUTH_FLAG_OPTIONS);
    reply.clearCookie("mf_plan", AUTH_FLAG_OPTIONS);
    return reply.send({ ok: true });
  });

  app.get("/auth/me", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      const user = await app.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, name: true, role: true, plan: true, createdAt: true }
      });

      if (!user) {
        return reply.code(404).send({ ok: false, message: "User not found" });
      }

      return reply.send({ ok: true, user });
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });

  app.post("/auth/forgot", { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
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

  app.post("/auth/reset", { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
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

  app.patch("/auth/password", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      const body = request.body as { currentPassword?: string; newPassword?: string };

      if (!body?.currentPassword || !body?.newPassword) {
        return reply.code(400).send({ ok: false, message: "currentPassword and newPassword are required" });
      }

      if (body.newPassword.length < 8) {
        return reply.code(400).send({ ok: false, message: "New password must be at least 8 characters" });
      }

      const user = await app.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) return reply.code(404).send({ ok: false, message: "User not found" });

      const isValid = await bcrypt.compare(body.currentPassword, user.passwordHash);
      if (!isValid) {
        return reply.code(401).send({ ok: false, message: "Current password is incorrect" });
      }

      const passwordHash = await bcrypt.hash(body.newPassword, 10);
      await app.prisma.user.update({ where: { id: payload.sub }, data: { passwordHash } });

      return reply.send({ ok: true });
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });
}
