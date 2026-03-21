declare module "fastify" {
  interface FastifyInstance {
    config: {
      NODE_ENV: string;
      PORT: string;
      DATABASE_URL: string;
      CORS_ORIGIN: string;
      JWT_SECRET: string;
      CSRF_SECRET: string;
      SMTP_HOST: string;
      SMTP_PORT: string;
      SMTP_USER: string;
      SMTP_PASS: string;
      SMTP_FROM: string;
      REDIS_URL: string;
      META_APP_ID: string;
      META_APP_SECRET: string;
      APP_URL: string;
      SHOPIFY_API_KEY: string;
      SHOPIFY_API_SECRET: string;
      STRIPE_SECRET_KEY: string;
      STRIPE_WEBHOOK_SECRET: string;
      STRIPE_PRICE_GROWTH: string;
      STRIPE_PRICE_SCALE: string;
      ENCRYPTION_KEY: string;
    };
  }
}
