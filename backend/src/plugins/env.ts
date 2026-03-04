import fp from "fastify-plugin";
import env from "@fastify/env";

const schema = {
  type: "object",
  required: ["PORT", "DATABASE_URL", "JWT_SECRET", "CSRF_SECRET"],
  properties: {
    NODE_ENV: { type: "string", default: "development" },
    PORT: { type: "string", default: "4000" },
    DATABASE_URL: { type: "string" },
    CORS_ORIGIN: { type: "string", default: "http://localhost:3000" },
    JWT_SECRET: { type: "string" },
    CSRF_SECRET: { type: "string" },
    SMTP_HOST: { type: "string", default: "" },
    SMTP_PORT: { type: "string", default: "587" },
    SMTP_USER: { type: "string", default: "" },
    SMTP_PASS: { type: "string", default: "" },
    SMTP_FROM: { type: "string", default: "no-reply@metaflow.app" },
    REDIS_URL: { type: "string", default: "redis://localhost:6379" }
  }
};

export default fp(async (app) => {
  await app.register(env, {
    schema,
    dotenv: true
  });
});
