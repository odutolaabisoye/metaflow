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
  timeWindow: "1 minute"
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
await app.register(debugRoutes, { prefix: "/v1" });
await app.register(analyticsRoutes, { prefix: "/v1" });
await app.register(stripeRoutes, { prefix: "/v1" });
await app.register(teamRoutes, { prefix: "/v1" });

// Shopify App install flow — no /v1 prefix (URLs set in Shopify Partner Dashboard)
await app.register(shopifyAppRoutes);

const port = Number(app.config.PORT || 4000);

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
