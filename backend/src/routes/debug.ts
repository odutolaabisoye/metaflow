import type { FastifyInstance } from "fastify";

const META_GRAPH_VERSION = "v19.0";
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

async function verifyAdmin(app: FastifyInstance, request: any, reply: any) {
  try {
    const payload = await request.jwtVerify<{ sub: string; role: string }>();
    if (payload.role !== "ADMIN") {
      reply.code(403).send({ ok: false, message: "Forbidden" });
      return null;
    }
    return payload;
  } catch {
    reply.code(401).send({ ok: false, message: "Unauthorized" });
    return null;
  }
}

async function metaGet<T>(path: string, token: string, params: Record<string, string> = {}): Promise<{ data: T | null; error: string | null }> {
  try {
    const url = new URL(`${META_GRAPH_BASE}${path}`);
    url.searchParams.set("access_token", token);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url.toString());
    const body = await res.json() as any;
    if (!res.ok) {
      const msg = body?.error?.message ?? `HTTP ${res.status}`;
      return { data: null, error: msg };
    }
    return { data: body as T, error: null };
  } catch (err: any) {
    return { data: null, error: err?.message ?? "Network error" };
  }
}

export async function debugRoutes(app: FastifyInstance) {
  /**
   * GET /admin/meta-debug?storeId=xxx
   * Returns a full diagnostic snapshot of the Meta connection for a store:
   *  - Token validity (/me)
   *  - Ad accounts
   *  - Adsets with promoted_object (catalog links)
   *  - Catalog products (first 30) with match result against DB
   *  - Sample insights (with and without product breakdown)
   *  - DB product index (SKU / externalId for matching)
   */
  app.get("/admin/meta-debug", async (request, reply) => {
    const admin = await verifyAdmin(app, request, reply);
    if (!admin) return;

    const { storeId, adAccountId: selectedAdAccountId } = request.query as { storeId?: string; adAccountId?: string };
    if (!storeId) {
      return reply.code(400).send({ ok: false, message: "storeId query param is required" });
    }

    // ── 1. Load Meta connection from DB ────────────────────────────────────────
    const connection = await app.prisma.connection.findFirst({
      where: { storeId, provider: "META" },
      select: { id: true, provider: true, scopes: true, expiresAt: true, createdAt: true, updatedAt: true, accessToken: true }
    });

    if (!connection) {
      return reply.send({
        ok: true, storeId,
        connection: null,
        meta: null,
        dbProducts: []
      });
    }

    const { accessToken, ...connPublic } = connection;
    const now = Date.now();
    const isExpired = connection.expiresAt ? connection.expiresAt.getTime() < now : false;
    const daysUntilExpiry = connection.expiresAt
      ? Math.ceil((connection.expiresAt.getTime() - now) / 86_400_000)
      : null;

    // ── 2. Validate token via /me ───────────────────────────────────────────────
    const meResult = await metaGet<{ id: string; name: string }>(
      "/me", accessToken, { fields: "id,name" }
    );

    // ── 3. Ad accounts ─────────────────────────────────────────────────────────
    const adAccountsResult = await metaGet<{ data: Array<{ id: string; account_id: string; name: string; currency: string; timezone_name: string }> }>(
      "/me/adaccounts", accessToken,
      { fields: "account_id,name,currency,timezone_name", limit: "50" }
    );
    const adAccounts = adAccountsResult.data?.data ?? [];
    // Use the requested ad account if provided, otherwise default to first
    const activeAccount = selectedAdAccountId
      ? (adAccounts.find(a => a.id === selectedAdAccountId) ?? adAccounts[0])
      : adAccounts[0];

    // ── 4. Adsets (from active/selected account) ────────────────────────────────
    let adSets: any[] = [];
    let adSetsError: string | null = null;
    if (activeAccount) {
      const r = await metaGet<{ data: any[] }>(
        `/${activeAccount.id}/adsets`, accessToken,
        { fields: "id,name,status,promoted_object", limit: "100" }
      );
      adSets = r.data?.data ?? [];
      adSetsError = r.error;
    }

    // Collect unique catalog IDs from adsets (primary strategy)
    const catalogIds = new Set<string>();
    for (const adset of adSets) {
      const cid = adset.promoted_object?.product_catalog_id;
      if (cid) catalogIds.add(cid);
    }

    // Fallback strategy 1: direct /{accountId}/product_catalogs endpoint
    if (catalogIds.size === 0 && activeAccount) {
      const r = await metaGet<{ data: Array<{ id: string }> }>(
        `/${activeAccount.id}/product_catalogs`, accessToken,
        { fields: "id", limit: "50" }
      );
      for (const c of r.data?.data ?? []) {
        if (c.id) catalogIds.add(c.id);
      }
    }

    // Fallback strategy 2: business-owned catalogs
    if (catalogIds.size === 0) {
      const bizRes = await metaGet<{ data: Array<{ id: string }> }>(
        "/me/businesses", accessToken,
        { fields: "id", limit: "20" }
      );
      await Promise.all((bizRes.data?.data ?? []).map(async (biz: any) => {
        const catRes = await metaGet<{ data: Array<{ id: string }> }>(
          `/${biz.id}/owned_product_catalogs`, accessToken,
          { fields: "id", limit: "50" }
        );
        for (const c of catRes.data?.data ?? []) {
          if (c.id) catalogIds.add(c.id);
        }
      }));
    }

    // ── 5. Load DB product index ────────────────────────────────────────────────
    const dbProductIndex = await app.prisma.productMeta.findMany({
      where: { storeId },
      select: { id: true, title: true, sku: true, externalId: true },
      take: 200
    });

    const byExternal = new Map<string, { id: string; title: string }>();
    const bySku = new Map<string, { id: string; title: string }>();
    for (const p of dbProductIndex) {
      if (p.externalId) {
        byExternal.set(p.externalId, p);
        const norm = normalizeId(p.externalId);
        if (norm) byExternal.set(norm, p);
      }
      if (p.sku) {
        bySku.set(p.sku, p);
        const norm = normalizeId(p.sku);
        if (norm) bySku.set(norm, p);
      }
    }

    function normalizeId(v?: string | null): string | null {
      if (!v) return null;
      const digits = v.trim().match(/\d+/g)?.join("") ?? "";
      return digits.length > 0 ? digits : v.trim();
    }

    function lookupProduct(identifier: string) {
      const norm = normalizeId(identifier);
      return (
        byExternal.get(identifier) ??
        (norm ? byExternal.get(norm) : undefined) ??
        bySku.get(identifier) ??
        (norm ? bySku.get(norm) : undefined) ??
        null
      );
    }

    function extractSkuFromTitle(title?: string | null): string | null {
      if (!title) return null;
      const m = title.match(/^([^,]+),\s/);
      return m ? m[1].trim() : null;
    }

    // ── 6. Catalog products + matching ─────────────────────────────────────────
    const catalogResults: any[] = [];
    for (const catalogId of catalogIds) {
      const r = await metaGet<{ data: Array<{ id: string; retailer_id?: string; name?: string }> }>(
        `/${catalogId}/products`, accessToken,
        { fields: "id,retailer_id,name", limit: "30" }
      );

      if (r.error) {
        catalogResults.push({ catalogId, products: [], error: r.error });
        continue;
      }

      const products = (r.data?.data ?? []).map(item => {
        let matchedProduct: { id: string; title: string } | null = null;
        let matchMethod: string | null = null;

        // Try retailer_id
        if (item.retailer_id) {
          matchedProduct = lookupProduct(item.retailer_id);
          if (matchedProduct) matchMethod = "retailer_id";
        }
        // Try SKU extracted from title ("25122, Product Name")
        if (!matchedProduct) {
          const sku = extractSkuFromTitle(item.name);
          if (sku) {
            matchedProduct = lookupProduct(sku);
            if (matchedProduct) matchMethod = "title_sku";
          }
        }
        // Try raw catalog item ID
        if (!matchedProduct) {
          matchedProduct = lookupProduct(item.id);
          if (matchedProduct) matchMethod = "catalog_id";
        }

        return {
          catalogItemId: item.id,
          retailer_id: item.retailer_id ?? null,
          name: item.name ?? null,
          matchedProductId: matchedProduct?.id ?? null,
          matchedProductTitle: matchedProduct?.title ?? null,
          matchMethod
        };
      });

      catalogResults.push({ catalogId, products, error: null });
    }

    // ── 7. Sample insights (no breakdown) ──────────────────────────────────────
    const SAMPLE_FIELDS = "impressions,clicks,spend,ctr,purchase_roas,actions,action_values,adset_id,ad_id";
    const SAMPLE_RANGE = JSON.stringify({
      since: new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10),
      until: new Date().toISOString().slice(0, 10)
    });

    let sampleInsights: any[] = [];
    let sampleInsightsError: string | null = null;

    if (activeAccount) {
      const r = await metaGet<{ data: any[] }>(
        `/${activeAccount.id}/insights`, accessToken,
        { level: "ad", time_range: SAMPLE_RANGE, time_increment: "1", fields: SAMPLE_FIELDS, limit: "5" }
      );
      sampleInsights = r.data?.data ?? [];
      sampleInsightsError = r.error;
    }

    // ── 8. Sample insights (with product breakdown) ─────────────────────────────
    let sampleProductInsights: any[] = [];
    let sampleProductInsightsError: string | null = null;

    if (activeAccount && catalogIds.size > 0) {
      const r = await metaGet<{ data: any[] }>(
        `/${activeAccount.id}/insights`, accessToken,
        {
          level: "ad",
          time_range: SAMPLE_RANGE,
          time_increment: "1",
          breakdowns: "product_id",
          fields: SAMPLE_FIELDS,
          limit: "10"
        }
      );
      sampleProductInsights = r.data?.data ?? [];
      sampleProductInsightsError = r.error;
    }

    return reply.send({
      ok: true,
      storeId,
      connection: {
        ...connPublic,
        isExpired,
        daysUntilExpiry,
        tokenPreview: `${accessToken.slice(0, 12)}…${accessToken.slice(-6)}`
      },
      meta: {
        me: meResult.data,
        meError: meResult.error,
        adAccounts,
        adAccountsError: adAccountsResult.error,
        activeAccountId: activeAccount?.id ?? null,
        adSets: adSets.slice(0, 50),
        adSetsError,
        catalogCount: catalogIds.size,
        catalogs: catalogResults,
        sampleInsights,
        sampleInsightsError,
        sampleProductInsights,
        sampleProductInsightsError
      },
      dbProducts: dbProductIndex.slice(0, 50)
    });
  });

  /**
   * GET /admin/meta-debug/stores
   * Returns ALL stores so any store can be selected for debugging,
   * with a flag indicating whether it has a Meta connection.
   */
  app.get("/admin/meta-debug/stores", async (request, reply) => {
    const admin = await verifyAdmin(app, request, reply);
    if (!admin) return;

    const stores = await app.prisma.store.findMany({
      select: {
        id: true,
        name: true,
        platform: true,
        connections: {
          where: { provider: "META" },
          select: { expiresAt: true, updatedAt: true }
        },
        _count: { select: { products: true } }
      },
      orderBy: { name: "asc" }
    });

    return reply.send({ ok: true, stores });
  });
}
