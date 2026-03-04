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
import { securityRoutes } from "./routes/security.js";

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
  origin: app.config.CORS_ORIGIN,
  credentials: true
});

await app.register(helmet);
await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute"
});
await app.register(csrfProtection, {
  sessionPlugin: "@fastify/cookie",
  cookieOpts: {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production"
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
await app.register(productRoutes, { prefix: "/v1" });

const port = Number(app.config.PORT || 4000);

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
