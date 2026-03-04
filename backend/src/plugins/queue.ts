import fp from "fastify-plugin";
import { Queue } from "bullmq";

export default fp(async (app) => {
  const connection = app.redis;

  const scoringQueue = new Queue("scoring", { connection });
  const syncQueue = new Queue("sync", { connection });

  app.decorate("queues", { scoringQueue, syncQueue });

  app.addHook("onClose", async () => {
    await scoringQueue.close();
    await syncQueue.close();
  });
});

declare module "fastify" {
  interface FastifyInstance {
    queues: {
      scoringQueue: Queue;
      syncQueue: Queue;
    };
  }
}
