import type { FastifyRequest, FastifyReply } from "fastify";

/**
 * Verifies the JWT attached to the request, then validates that the token
 * payload contains a non-empty `sub` claim.
 *
 * Returns the payload on success, or sends a 401 and returns null.
 * Callers should check for null and return immediately:
 *
 *   const payload = await requireAuth(request, reply);
 *   if (!payload) return;
 */
export async function requireAuth<T extends { sub: string }>(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<T | null> {
  try {
    const payload = await request.jwtVerify<T>();
    if (!payload?.sub) {
      reply.code(401).send({ ok: false, message: "Unauthorized" });
      return null;
    }
    return payload;
  } catch {
    reply.code(401).send({ ok: false, message: "Unauthorized" });
    return null;
  }
}
