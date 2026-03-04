import fp from "fastify-plugin";
import Redis from "ioredis";

export default fp(async (app) => {
  const redis = new Redis(app.config.REDIS_URL, {
    maxRetriesPerRequest: null
  });

  app.decorate("redis", redis);

  app.addHook("onClose", async (fastify) => {
    await fastify.redis.quit();
  });
});

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}
