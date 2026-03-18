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
    REDIS_URL: { type: "string", default: "redis://localhost:6379" },
    META_APP_ID: { type: "string", default: "" },
    META_APP_SECRET: { type: "string", default: "" },
    APP_URL: { type: "string", default: "http://localhost:4000" },
    SHOPIFY_API_KEY: { type: "string", default: "" },
    SHOPIFY_API_SECRET: { type: "string", default: "" },
    STRIPE_SECRET_KEY: { type: "string", default: "" },
    STRIPE_WEBHOOK_SECRET: { type: "string", default: "" },
    STRIPE_PRICE_GROWTH: { type: "string", default: "" },
    STRIPE_PRICE_SCALE: { type: "string", default: "" }
  }
};

export default fp(async (app) => {
  await app.register(env, {
    schema,
    dotenv: true
  });
});
