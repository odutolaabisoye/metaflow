import type { FastifyInstance } from "fastify";

export async function productRoutes(app: FastifyInstance) {
  app.get("/products", async (request) => {
    const { range = "30d", sortBy = "score", sortDir = "desc" } = request.query as Record<string, string>;

    return {
      ok: true,
      range,
      sortBy,
      sortDir,
      items: [],
      total: 0
    };
  });
}
