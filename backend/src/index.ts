import * as Sentry from "@sentry/node";

// Init Sentry before any other imports so errors during startup are captured
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn:              process.env.SENTRY_DSN,
    environment:      process.env.NODE_ENV ?? "production",
    tracesSampleRate: 0.05,
    release:          process.env.SENTRY_RELEASE ?? undefined,
  });
}

import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import csrfProtection from "@fastify/csrf-protection";
import envPlugin from "./plugins/env.js";
import prismaPlugin from "./plugins/prisma.js";
import mailPlugin from "./plugins/mail.js";
import redisPlugin from "./plugins/redis.js";
import queuePlugin from "./plugins/queue.js";
import bullBoardPlugin from "./plugins/bullboard.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { productRoutes } from "./routes/products.js";
import { connectionRoutes } from "./routes/connections.js";
import { storeRoutes } from "./routes/stores.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { securityRoutes } from "./routes/security.js";
import { auditRoutes } from "./routes/audit.js";
import { settingsRoutes } from "./routes/settings.js";
import { adminRoutes } from "./routes/admin.js";
import { debugRoutes } from "./routes/debug.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { stripeRoutes } from "./routes/stripe.js";
import { teamRoutes } from "./routes/teams.js";
import { shopifyAppRoutes } from "./routes/shopifyApp.js";
import { wooWebhookRoutes } from "./routes/wooWebhooks.js";

const app = Fastify({
  logger: {
    transport: {
      target: "pino-pretty",
      options: { colorize: true }
    }
  }
});

await app.register(envPlugin);
await app.register(prismaPlugin);
await app.register(mailPlugin);
await app.register(redisPlugin);
await app.register(queuePlugin);
await app.register(bullBoardPlugin);

await app.register(cors, {
  origin: (origin, cb) => {
    // Allow all configured origins (comma-separated) + any localhost port for dev
    const allowed = (app.config.CORS_ORIGIN ?? "").split(",").map(s => s.trim()).filter(Boolean);
    if (!origin || /^https?:\/\/localhost(:\d+)?$/.test(origin) || allowed.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error("Not allowed by CORS"), false);
    }
  },
  credentials: true
});

await app.register(helmet);
await app.register(rateLimit, {
  // Generous global limit — supports rapid pagination, sort changes, search debounce, etc.
  // Auth routes (login / signup / password reset) override this with a much tighter limit
  // via config.rateLimit on each route to prevent brute-force attacks.
  max: 600,
  timeWindow: "1 minute",
  // Redis-backed rate limiting for multi-instance deployments
  redis: app.redis
});
const isProd = process.env.NODE_ENV === "production";
await app.register(csrfProtection, {
  sessionPlugin: "@fastify/cookie",
  cookieOpts: {
    path: "/",
    // Cross-origin (Netlify frontend ↔ Hetzner API) requires SameSite=none + Secure in prod.
    // Locally we use "lax" so dev works without HTTPS.
    sameSite: isProd ? "none" : "lax",
    httpOnly: true,
    secure: isProd
  },
  secret: app.config.CSRF_SECRET
});

await app.register(cookie);
await app.register(jwt, {
  secret: app.config.JWT_SECRET,
  cookie: {
    cookieName: "mf_session",
    signed: false
  },
  sign: { expiresIn: "7d" }
});

// JWT blacklist (logout revocation). Only blocks requests with blacklisted jti.
app.addHook("preHandler", async (request, reply) => {
  if (!app.redis) return;
  const hasCookie = Boolean((request as any).cookies?.mf_session);
  const authHeader = request.headers.authorization;
  const hasBearer = typeof authHeader === "string" && authHeader.startsWith("Bearer ");
  if (!hasCookie && !hasBearer) return;

  try {
    const payload = hasBearer
      ? await request.jwtVerify<{ jti?: string }>({ token: authHeader.slice(7) })
      : await request.jwtVerify<{ jti?: string }>();
    if (!payload?.jti) return;
    const isRevoked = await app.redis.get(`jwt:bl:${payload.jti}`);
    if (isRevoked) {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  } catch {
    // Ignore invalid/expired tokens here; protected routes will handle auth.
  }
});

await app.register(healthRoutes);
await app.register(securityRoutes, { prefix: "/v1" });
await app.register(authRoutes, { prefix: "/v1" });
await app.register(storeRoutes, { prefix: "/v1" });
await app.register(productRoutes, { prefix: "/v1" });
await app.register(dashboardRoutes, { prefix: "/v1" });
await app.register(auditRoutes, { prefix: "/v1" });
await app.register(connectionRoutes, { prefix: "/v1" });
await app.register(settingsRoutes, { prefix: "/v1" });
await app.register(adminRoutes, { prefix: "/v1" });
if (process.env.NODE_ENV !== "production") {
  await app.register(debugRoutes, { prefix: "/v1" });
  app.log.info("[startup] Debug routes enabled (non-production)");
} else {
  app.log.info("[startup] Debug routes disabled in production");
}
await app.register(analyticsRoutes, { prefix: "/v1" });
await app.register(stripeRoutes, { prefix: "/v1" });
await app.register(teamRoutes, { prefix: "/v1" });

// Shopify App install flow — no /v1 prefix (URLs set in Shopify Partner Dashboard)
await app.register(shopifyAppRoutes);

// WooCommerce webhooks — no /v1 prefix (delivery URLs registered via WooCommerce REST API)
await app.register(wooWebhookRoutes);

const port = Number(app.config.PORT || 4000);

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  Sentry.captureException(err);
  app.log.error(err);
  process.exit(1);
}
