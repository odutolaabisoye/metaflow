import type { FastifyInstance } from "fastify";

export async function securityRoutes(app: FastifyInstance) {
  app.get("/csrf", async (request, reply) => {
    const token = await reply.generateCsrf();
    return { ok: true, csrfToken: token };
  });
}
