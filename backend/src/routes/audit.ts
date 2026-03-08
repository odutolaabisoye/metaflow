import type { FastifyInstance } from "fastify";

const RANGE_PRESETS = new Set(["7d", "30d", "90d"]);

function normalizeRange(range?: string) {
  const safeRange = range && RANGE_PRESETS.has(range) ? range : "30d";
  const days = Number.parseInt(safeRange.replace("d", ""), 10);
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days + 1);
  return { range: safeRange, start, end };
}

function normalizeLimit(limit?: string) {
  const value = Math.min(Math.max(Number.parseInt(limit ?? "50", 10) || 50, 1), 200);
  return value;
}

function formatTime(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function deriveTagVariant(action: string, metadata?: Record<string, unknown>) {
  const tag = typeof metadata?.tag === "string" ? metadata.tag : undefined;
  const variant = typeof metadata?.variant === "string" ? metadata.variant : undefined;
  if (tag && variant) return { tag, variant };

  const a = action.toLowerCase();
  if (a.includes("scale") || a.includes("boost") || a.includes("increase")) {
    return { tag: "Scale", variant: "secondary" };
  }
  if (a.includes("kill") || a.includes("pause") || a.includes("suppress") || a.includes("stop")) {
    return { tag: "Kill", variant: "destructive" };
  }
  if (a.includes("risk") || a.includes("inventory") || a.includes("alert")) {
    return { tag: "Risk", variant: "default" };
  }
  return { tag: "Info", variant: "default" };
}

function buildMeta(metadata?: Record<string, unknown>) {
  if (!metadata) return null;
  const parts: string[] = [];
  const provider = metadata.provider as string | undefined;
  if (provider) parts.push(`Provider: ${provider}`);
  const products = metadata.products as number | undefined;
  if (typeof products === "number") parts.push(`Products: ${products}`);
  const orders = metadata.orders as number | undefined;
  if (typeof orders === "number") parts.push(`Orders: ${orders}`);
  const adAccounts = metadata.adAccounts as number | undefined;
  if (typeof adAccounts === "number") parts.push(`Ad accounts: ${adAccounts}`);
  const insightsMatched = metadata.insightsMatched as number | undefined;
  if (typeof insightsMatched === "number") parts.push(`Insights: ${insightsMatched}`);
  const scaled = metadata.scaled as number | undefined;
  const killed = metadata.killed as number | undefined;
  const risked = metadata.risked as number | undefined;
  if (typeof scaled === "number") parts.push(`Scaled: ${scaled}`);
  if (typeof killed === "number") parts.push(`Killed: ${killed}`);
  if (typeof risked === "number") parts.push(`Risk: ${risked}`);
  return parts.length ? parts.join(" · ") : null;
}

export async function auditRoutes(app: FastifyInstance) {
  /**
   * GET /audit
   *
   * Query params:
   *   storeId? — defaults to first store
   *   range?   — "7d" | "30d" | "90d" (default: "30d")
   *   cursor?  — cursor-based pagination (audit id)
   *   limit?   — max 200, default 50
   */
  app.get("/audit", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      const { storeId, range = "30d", cursor, limit = "50" } =
        request.query as Record<string, string>;

      let resolvedStoreId = storeId;
      if (!resolvedStoreId) {
        const store = await app.prisma.store.findFirst({
          where: { ownerId: payload.sub },
          orderBy: { createdAt: "asc" },
          select: { id: true }
        });
        if (!store) {
          return reply.send({ ok: true, events: [], total: 0, hasMore: false, nextCursor: null });
        }
        resolvedStoreId = store.id;
      } else {
        const store = await app.prisma.store.findFirst({
          where: { id: resolvedStoreId, ownerId: payload.sub },
          select: { id: true }
        });
        if (!store) {
          return reply.code(403).send({ ok: false, message: "Forbidden" });
        }
      }

      const { start } = normalizeRange(range);
      const take = normalizeLimit(limit);

      const [logs, total] = await app.prisma.$transaction([
        app.prisma.auditLog.findMany({
          where: { storeId: resolvedStoreId, createdAt: { gte: start } },
          orderBy: { createdAt: "desc" },
          take: take + 1,
          ...(cursor && { cursor: { id: cursor }, skip: 1 })
        }),
        app.prisma.auditLog.count({
          where: { storeId: resolvedStoreId, createdAt: { gte: start } }
        })
      ]);

      const hasMore = logs.length > take;
      const items = hasMore ? logs.slice(0, take) : logs;
      const nextCursor = hasMore ? items[items.length - 1].id : null;

      const events = items.map((log) => {
        const metadata = typeof log.metadata === "object" && log.metadata !== null
          ? (log.metadata as Record<string, unknown>)
          : undefined;
        const { tag, variant } = deriveTagVariant(log.action, metadata);
        return {
          id: log.id,
          title: log.action,
          detail: log.detail ?? "",
          tag,
          variant,
          time: formatTime(log.createdAt),
          meta: buildMeta(metadata)
        };
      });

      return reply.send({
        ok: true,
        storeId: resolvedStoreId,
        total,
        events,
        hasMore,
        nextCursor
      });
    } catch (err) {
      app.log.error({ err }, "Audit fetch error");
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });
}
