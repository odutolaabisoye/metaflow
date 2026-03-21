import type { FastifyInstance } from "fastify";
import { decryptToken } from "../utils/crypto.js";
import { fetchWithRetry } from "../utils/http.js";

const META_GRAPH_VERSION = "v19.0";
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

// ── Date-range helpers (mirrors products.ts) ────────────────────────────────
function isValidDate(value?: string) {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
}

function parseRange(range?: string, start?: string, end?: string) {
  if (start && end && isValidDate(start) && isValidDate(end)) {
    const s = new Date(start);
    const e = new Date(end);
    if (s <= e) {
      s.setHours(0, 0, 0, 0);
      e.setHours(23, 59, 59, 999);
      return { start: s, end: e, range: range ?? "custom" };
    }
  }
  const now = new Date();
  const e = new Date(now);
  e.setHours(23, 59, 59, 999);
  if (range === "today") {
    const s = new Date(now); s.setHours(0, 0, 0, 0);
    return { start: s, end: e, range: "today" };
  }
  if (range === "yesterday") {
    const s = new Date(now); s.setDate(s.getDate() - 1); s.setHours(0, 0, 0, 0);
    const ye = new Date(s); ye.setHours(23, 59, 59, 999);
    return { start: s, end: ye, range: "yesterday" };
  }
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const s = new Date(now);
  s.setDate(s.getDate() - days + 1);
  s.setHours(0, 0, 0, 0);
  return { start: s, end: e, range: range ?? "30d" };
}

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
    const res = await fetchWithRetry(url.toString());
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
    const token = decryptToken(accessToken);
    const now = Date.now();
    const isExpired = connection.expiresAt ? connection.expiresAt.getTime() < now : false;
    const daysUntilExpiry = connection.expiresAt
      ? Math.ceil((connection.expiresAt.getTime() - now) / 86_400_000)
      : null;

    // ── 2. Validate token via /me ───────────────────────────────────────────────
    const meResult = await metaGet<{ id: string; name: string }>(
      "/me", token, { fields: "id,name" }
    );

    // ── 3. Ad accounts ─────────────────────────────────────────────────────────
    const adAccountsResult = await metaGet<{ data: Array<{ id: string; account_id: string; name: string; currency: string; timezone_name: string }> }>(
      "/me/adaccounts", token,
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
        `/${activeAccount.id}/adsets`, token,
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
        `/${activeAccount.id}/product_catalogs`, token,
        { fields: "id", limit: "50" }
      );
      for (const c of r.data?.data ?? []) {
        if (c.id) catalogIds.add(c.id);
      }
    }

    // Fallback strategy 2: business-owned catalogs
    if (catalogIds.size === 0) {
      const bizRes = await metaGet<{ data: Array<{ id: string }> }>(
        "/me/businesses", token,
        { fields: "id", limit: "20" }
      );
      await Promise.all((bizRes.data?.data ?? []).map(async (biz: any) => {
        const catRes = await metaGet<{ data: Array<{ id: string }> }>(
          `/${biz.id}/owned_product_catalogs`, token,
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
      select: { id: true, title: true, sku: true, externalId: true, altIds: true },
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
      for (const altId of p.altIds ?? []) {
        if (!byExternal.has(altId)) byExternal.set(altId, p);
        const norm = normalizeId(altId);
        if (norm && !byExternal.has(norm)) byExternal.set(norm, p);
      }
    }

    function normalizeId(v?: string | null): string | null {
      if (!v) return null;
      const trimmed = v.trim();
      if (!trimmed) return null;
      if (trimmed.startsWith("gid://shopify/")) {
        const digits = trimmed.match(/\d+/g)?.join("") ?? "";
        return digits.length > 0 ? digits : trimmed;
      }
      if (/^\d+$/.test(trimmed)) return trimmed;
      return trimmed;
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
        `/${catalogId}/products`, token,
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
        `/${activeAccount.id}/insights`, token,
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
        `/${activeAccount.id}/insights`, token,
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

    const [latestSummary, latestUnmatched] = await Promise.all([
      app.prisma.auditLog.findFirst({
        where: { storeId, action: "Meta Sync — Summary" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, detail: true, metadata: true }
      }),
      app.prisma.auditLog.findFirst({
        where: { storeId, action: "Meta Sync — Unmatched Catalog Products" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, detail: true, metadata: true }
      })
    ]);

    return reply.send({
      ok: true,
      storeId,
      connection: {
        ...connPublic,
        isExpired,
        daysUntilExpiry,
        tokenPreview: `${token.slice(0, 12)}…${token.slice(-6)}`
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
        sampleProductInsightsError,
        syncSummary: latestSummary,
        unmatchedCatalog: latestUnmatched
      },
      dbProducts: dbProductIndex.slice(0, 50)
    });
  });

  /**
   * GET /admin/meta-token?storeId=xxx
   * ⚠️  ADMIN ONLY — returns the raw Meta access token for direct Graph API testing
   * (e.g. pasting into Postman). Never expose this to non-admin users.
   */
  app.get("/admin/meta-token", async (request, reply) => {
    const admin = await verifyAdmin(app, request, reply);
    if (!admin) return;

    const { storeId } = request.query as { storeId?: string };
    if (!storeId) {
      return reply.code(400).send({ ok: false, message: "storeId query param is required" });
    }

    const conn = await app.prisma.connection.findFirst({
      where: { storeId, provider: "META" },
      select: {
        accessToken: true,
        expiresAt: true,
        metaAdAccountId: true,
        metaCatalogId: true,
        scopes: true,
        updatedAt: true,
      },
    });

    if (!conn) {
      return reply.code(404).send({ ok: false, message: "No Meta connection found for this store" });
    }

    const now = Date.now();
    const isExpired = conn.expiresAt ? conn.expiresAt.getTime() < now : false;
    const daysUntilExpiry = conn.expiresAt
      ? Math.ceil((conn.expiresAt.getTime() - now) / 86_400_000)
      : null;

    return reply.send({
      ok: true,
      // Full token — admin Postman use only
      accessToken: decryptToken(conn.accessToken),
      metaAdAccountId: conn.metaAdAccountId ?? null,
      metaCatalogId: conn.metaCatalogId ?? null,
      scopes: conn.scopes ?? null,
      expiresAt: conn.expiresAt ?? null,
      isExpired,
      daysUntilExpiry,
      updatedAt: conn.updatedAt,
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

  /**
   * GET /admin/products-debug?storeId=xxx&range=30d&start=xxx&end=xxx&sortBy=spend&sortDir=desc&page=0&limit=50
   *
   * Returns raw aggregated metric data for every product in a store over the
   * selected date range — useful for diagnosing why the product listing shows
   * wrong ROAS / revenue / spend values.
   *
   * Response includes:
   *  - Resolved date range (ISO since/until + human label)
   *  - Stats: totalProducts, productsWithMetrics, productsWithNoMetrics, totalMetricRows
   *  - Paginated items with rawSums, rawAvgs, computed metrics, and latest snapshot
   */
  app.get("/admin/products-debug", async (request, reply) => {
    const admin = await verifyAdmin(app, request, reply);
    if (!admin) return;

    const {
      storeId,
      range  = "30d",
      start,
      end,
      sortBy  = "spend",
      sortDir = "desc",
      page    = "0",
      limit   = "50",
    } = request.query as Record<string, string>;

    if (!storeId) {
      return reply.code(400).send({ ok: false, message: "storeId query param is required" });
    }

    const store = await app.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, name: true, currency: true },
    });
    if (!store) {
      return reply.code(404).send({ ok: false, message: "Store not found" });
    }

    const { start: since, end: until, range: resolvedRange } = parseRange(range, start, end);
    const take    = Math.min(parseInt(limit, 10) || 50, 200);
    const pageNum = Math.max(0, parseInt(page, 10) || 0);

    // ── 1. Counts ─────────────────────────────────────────────────────────────
    const [totalProducts, totalMetricRows] = await Promise.all([
      app.prisma.productMeta.count({ where: { storeId } }),
      app.prisma.dailyMetric.count({ where: { storeId, date: { gte: since, lte: until } } }),
    ]);

    // ── 2. All product meta (for lookup) ─────────────────────────────────────
    const allProductsMeta = await app.prisma.productMeta.findMany({
      where: { storeId },
      select: { id: true, title: true, sku: true, category: true, score: true },
    });
    const productLookup = new Map(allProductsMeta.map(p => [p.id, p]));

    // ── 3. Aggregate metrics in date range for every product ──────────────────
    const metricsAgg = await app.prisma.dailyMetric.groupBy({
      by: ["productId"],
      where: { storeId, date: { gte: since, lte: until } },
      _sum: {
        revenue: true, metaRevenue: true, spend: true,
        impressions: true, clicks: true, conversions: true,
        addToCart: true, addToCartOmni: true,
        checkoutInitiated: true, checkoutInitiatedOmni: true,
      },
      _avg: { margin: true, velocity: true },
      _count: { date: true },
    });

    const productsWithMetrics    = metricsAgg.length;
    const productsWithNoMetrics  = totalProducts - productsWithMetrics;
    const metricMap              = new Map(metricsAgg.map(m => [m.productId, m]));

    // ── 4. Build flat list with computed values ───────────────────────────────
    const allRows = allProductsMeta.map(p => {
      const m      = metricMap.get(p.id);
      const metaRev = m?._sum.metaRevenue ?? 0;
      const rev     = m?._sum.revenue     ?? 0;
      const spd     = m?._sum.spend       ?? 0;
      const imp     = m?._sum.impressions ?? 0;
      const clk     = m?._sum.clicks      ?? 0;
      const cvt     = m?._sum.conversions ?? 0;

      return {
        productId:      p.id,
        title:          p.title,
        sku:            p.sku ?? null,
        category:       p.category ?? null,
        score:          p.score,
        metricRowCount: m?._count.date ?? 0,
        hasMetrics:     !!m,
        rawSums: {
          revenue: rev, metaRevenue: metaRev, spend: spd, impressions: imp, clicks: clk, conversions: cvt,
          addToCart:             m?._sum.addToCart             ?? 0,
          addToCartOmni:         m?._sum.addToCartOmni         ?? 0,
          checkoutInitiated:     m?._sum.checkoutInitiated     ?? 0,
          checkoutInitiatedOmni: m?._sum.checkoutInitiatedOmni ?? 0,
        },
        rawAvgs: { margin: m?._avg.margin ?? null, velocity: m?._avg.velocity ?? null },
        computed: {
          roas:           spd > 0 ? metaRev / spd : 0,
          blendedRoas:    spd > 0 && rev > 0 ? rev / spd : null,
          ctr:            imp > 0 ? clk / imp : 0,
          conversionRate: clk > 0 ? cvt / clk : 0,
        },
      };
    });

    // ── 5. Sort in-memory ─────────────────────────────────────────────────────
    allRows.sort((a, b) => {
      let va = 0, vb = 0;
      if      (sortBy === "revenue")     { va = a.rawSums.revenue;     vb = b.rawSums.revenue; }
      else if (sortBy === "metaRevenue") { va = a.rawSums.metaRevenue; vb = b.rawSums.metaRevenue; }
      else if (sortBy === "spend")       { va = a.rawSums.spend;       vb = b.rawSums.spend; }
      else if (sortBy === "impressions") { va = a.rawSums.impressions; vb = b.rawSums.impressions; }
      else if (sortBy === "clicks")      { va = a.rawSums.clicks;      vb = b.rawSums.clicks; }
      else if (sortBy === "roas")        { va = a.computed.roas;       vb = b.computed.roas; }
      else if (sortBy === "score")       { va = a.score;               vb = b.score; }
      else if (sortBy === "metricRows")  { va = a.metricRowCount;      vb = b.metricRowCount; }
      return sortDir === "asc" ? va - vb : vb - va;
    });

    // ── 6. Paginate ───────────────────────────────────────────────────────────
    const paged      = allRows.slice(pageNum * take, (pageNum + 1) * take);
    const totalPages = Math.ceil(allRows.length / take);

    // ── 7. Latest snapshot per page product (inventoryLevel, blendedRoas) ────
    const pageProductIds = paged.map(r => r.productId);
    const latestSnapshots = pageProductIds.length > 0
      ? await app.prisma.dailyMetric.findMany({
          where:    { storeId, productId: { in: pageProductIds } },
          orderBy:  [{ date: "desc" }, { updatedAt: "desc" }],
          distinct: ["productId"],
          select:   { productId: true, inventoryLevel: true, blendedRoas: true, date: true },
        })
      : [];
    const snapMap = new Map(latestSnapshots.map(s => [s.productId, s]));

    const items = paged.map(r => ({
      ...r,
      snapshot: snapMap.get(r.productId) ?? null,
    }));

    return reply.send({
      ok: true,
      store:   { id: store.id, name: store.name, currency: store.currency },
      params:  { range, start: start ?? null, end: end ?? null, sortBy, sortDir, page: pageNum, limit: take },
      dateRange: {
        resolved:  resolvedRange,
        since:     since.toISOString(),
        until:     until.toISOString(),
        sinceDate: since.toISOString().slice(0, 10),
        untilDate: until.toISOString().slice(0, 10),
      },
      stats: { totalProducts, productsWithMetrics, productsWithNoMetrics, totalMetricRows },
      page:       pageNum,
      totalPages,
      total:      allRows.length,
      items,
    });
  });

  /**
   * GET /admin/products-debug/sku?storeId=xxx&sku=SKU123&range=30d
   *
   * Looks up one or more products by SKU / title / externalId and returns their
   * complete day-by-day DailyMetric breakdown for the given date range.
   *
   * Each daily row shows BOTH the stored values written by syncMeta (campaign-level,
   * often the same across products) AND the per-product computed values derived from
   * the per-product sums — making it easy to see exactly where discrepancies arise.
   */
  app.get("/admin/products-debug/sku", async (request, reply) => {
    const admin = await verifyAdmin(app, request, reply);
    if (!admin) return;

    const { storeId, sku, range = "30d", start, end } = request.query as Record<string, string>;

    if (!storeId) {
      return reply.code(400).send({ ok: false, message: "storeId query param is required" });
    }
    if (!sku?.trim()) {
      return reply.code(400).send({ ok: false, message: "sku query param is required" });
    }

    const store = await app.prisma.store.findUnique({
      where:  { id: storeId },
      select: { id: true, name: true, currency: true },
    });
    if (!store) {
      return reply.code(404).send({ ok: false, message: "Store not found" });
    }

    const { start: since, end: until, range: resolvedRange } = parseRange(range, start, end);

    // ── 1. Find matching products ─────────────────────────────────────────────
    const matchedProducts = await app.prisma.productMeta.findMany({
      where: {
        storeId,
        OR: [
          { sku:        { contains: sku.trim(), mode: "insensitive" } },
          { title:      { contains: sku.trim(), mode: "insensitive" } },
          { externalId: { contains: sku.trim(), mode: "insensitive" } },
        ],
      },
      select: { id: true, title: true, sku: true, externalId: true, category: true, score: true, updatedAt: true },
      take: 10,
    });

    if (!matchedProducts.length) {
      return reply.send({
        ok: true,
        store:     { id: store.id, name: store.name, currency: store.currency },
        dateRange: {
          resolved:  resolvedRange,
          since:     since.toISOString(),
          until:     until.toISOString(),
          sinceDate: since.toISOString().slice(0, 10),
          untilDate: until.toISOString().slice(0, 10),
        },
        query:   sku.trim(),
        matches: [],
      });
    }

    // ── 2. Fetch daily rows for all matched products ───────────────────────────
    const productIds = matchedProducts.map(p => p.id);

    const allDailyRows = await app.prisma.dailyMetric.findMany({
      where: {
        storeId,
        productId: { in: productIds },
        date:      { gte: since, lte: until },
      },
      orderBy: [{ productId: "asc" }, { date: "desc" }],
      select: {
        productId:      true,
        date:           true,
        revenue:        true,
        metaRevenue:    true,
        spend:          true,
        impressions:    true,
        clicks:         true,
        conversions:           true,
        addToCart:             true,
        addToCartOmni:         true,
        checkoutInitiated:     true,
        checkoutInitiatedOmni: true,
        inventoryLevel: true,
        // Stored values written by syncMeta (campaign-level, often shared across products)
        roas:           true,
        ctr:            true,
        conversionRate: true,
        blendedRoas:    true,
        margin:         true,
        velocity:       true,
      },
    });

    // ── 3. Group rows by product and compute totals ────────────────────────────
    const rowsByProduct = new Map<string, typeof allDailyRows>();
    for (const row of allDailyRows) {
      if (!rowsByProduct.has(row.productId)) rowsByProduct.set(row.productId, []);
      rowsByProduct.get(row.productId)!.push(row);
    }

    const matches = matchedProducts.map(p => {
      const rows = rowsByProduct.get(p.id) ?? [];

      // Aggregate totals from raw sums
      let totSpend = 0, totRev = 0, totMetaRev = 0, totImp = 0, totClk = 0, totCvt = 0;
      let totAtc = 0, totAtcOmni = 0, totCo = 0, totCoOmni = 0;
      for (const r of rows) {
        totSpend    += r.spend                  ?? 0;
        totRev      += r.revenue                ?? 0;
        totMetaRev  += r.metaRevenue            ?? 0;
        totImp      += r.impressions            ?? 0;
        totClk      += r.clicks                 ?? 0;
        totCvt      += r.conversions            ?? 0;
        totAtc      += r.addToCart              ?? 0;
        totAtcOmni  += r.addToCartOmni          ?? 0;
        totCo       += r.checkoutInitiated      ?? 0;
        totCoOmni   += r.checkoutInitiatedOmni  ?? 0;
      }

      return {
        product: {
          id:         p.id,
          title:      p.title,
          sku:        p.sku       ?? null,
          externalId: p.externalId ?? null,
          category:   p.category  ?? null,
          score:      p.score,
          updatedAt:  p.updatedAt,
        },
        rowCount: rows.length,
        // Day-by-day rows — most recent first
        dailyRows: rows.map(r => {
          const spd     = r.spend       ?? 0;
          const metaRev = r.metaRevenue ?? 0;
          const rev     = r.revenue     ?? 0;
          const imp     = r.impressions ?? 0;
          const clk     = r.clicks      ?? 0;
          const cvt     = r.conversions ?? 0;
          return {
            date:           r.date.toISOString().slice(0, 10),
            spend:          spd,
            revenue:        rev,
            metaRevenue:    metaRev,
            impressions:    imp,
            clicks:         clk,
            conversions:           cvt,
            addToCart:             r.addToCart             ?? 0,
            addToCartOmni:         r.addToCartOmni         ?? 0,
            checkoutInitiated:     r.checkoutInitiated     ?? 0,
            checkoutInitiatedOmni: r.checkoutInitiatedOmni ?? 0,
            inventoryLevel: r.inventoryLevel ?? null,
            margin:         r.margin         ?? null,
            velocity:       r.velocity       ?? null,
            // Stored values as written by syncMeta (campaign-level — same for all products in the campaign)
            stored: {
              roas:           r.roas           ?? null,
              ctr:            r.ctr            ?? null,
              conversionRate: r.conversionRate ?? null,
              blendedRoas:    r.blendedRoas    ?? null,
            },
            // Computed per-product values derived from the raw sums
            computed: {
              roas:           spd > 0 ? metaRev / spd : 0,
              blendedRoas:    spd > 0 && rev > 0 ? rev / spd : null,
              ctr:            imp > 0 ? clk / imp : 0,
              conversionRate: clk > 0 ? cvt / clk : 0,
            },
          };
        }),
        totals: {
          spend:                totSpend,
          revenue:              totRev,
          metaRevenue:          totMetaRev,
          impressions:          totImp,
          clicks:               totClk,
          conversions:          totCvt,
          addToCart:            totAtc,
          addToCartOmni:        totAtcOmni,
          checkoutInitiated:    totCo,
          checkoutInitiatedOmni: totCoOmni,
          computed: {
            roas:           totSpend > 0 ? totMetaRev / totSpend : 0,
            blendedRoas:    totSpend > 0 && totRev > 0 ? totRev / totSpend : null,
            ctr:            totImp > 0 ? totClk / totImp : 0,
            conversionRate: totClk > 0 ? totCvt / totClk : 0,
          },
        },
      };
    });

    return reply.send({
      ok: true,
      store:     { id: store.id, name: store.name, currency: store.currency },
      dateRange: {
        resolved:  resolvedRange,
        since:     since.toISOString(),
        until:     until.toISOString(),
        sinceDate: since.toISOString().slice(0, 10),
        untilDate: until.toISOString().slice(0, 10),
      },
      query:   sku.trim(),
      matches,
    });
  });
}
