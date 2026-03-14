import type { FastifyInstance } from "fastify";

const META_GRAPH_VERSION = "v19.0";
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

// ── Shared helpers ────────────────────────────────────────────────────────────

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

async function metaGet<T>(
  path: string,
  token: string,
  params: Record<string, string> = {}
): Promise<{ data: T | null; error: string | null }> {
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

/**
 * Verify the request is from a SCALE plan user or an ADMIN, and that they own
 * the requested store. Returns { sub } on success, or sends a 401/403 and returns null.
 */
async function verifyScaleAndOwnership(
  app: FastifyInstance,
  request: any,
  reply: any,
  storeId: string
): Promise<{ sub: string } | null> {
  let sub: string;
  let role: string;
  try {
    const payload = await request.jwtVerify<{ sub: string; role: string }>();
    sub = payload.sub;
    role = payload.role;
  } catch {
    reply.code(401).send({ ok: false, message: "Unauthorized" });
    return null;
  }

  // Allow admins through regardless of plan
  if (role !== "ADMIN") {
    const user = await app.prisma.user.findUnique({
      where: { id: sub },
      select: { plan: true }
    });
    if (user?.plan !== "SCALE") {
      reply.code(403).send({
        ok: false,
        code: "PLAN_REQUIRED",
        message: "Advanced Analytics requires a Scale plan. Upgrade to unlock this feature."
      });
      return null;
    }
  }

  // Verify store ownership (admins can see any store)
  if (role !== "ADMIN") {
    const store = await app.prisma.store.findFirst({
      where: { id: storeId, ownerId: sub },
      select: { id: true }
    });
    if (!store) {
      reply.code(403).send({ ok: false, message: "Store not found or access denied" });
      return null;
    }
  }

  return { sub };
}

export async function analyticsRoutes(app: FastifyInstance) {
  /**
   * GET /v1/analytics/products
   *
   * Products Analytics — SCALE plan (or ADMIN) only.
   * Same data as /admin/products-debug but scoped to the authenticated user's store.
   * Query params: storeId, range, start, end, sortBy, sortDir, page, limit
   */
  app.get("/analytics/products", async (request, reply) => {
    const {
      storeId,
      range   = "30d",
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

    const auth = await verifyScaleAndOwnership(app, request, reply, storeId);
    if (!auth) return;

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

    const [totalProducts, totalMetricRows] = await Promise.all([
      app.prisma.productMeta.count({ where: { storeId } }),
      app.prisma.dailyMetric.count({ where: { storeId, date: { gte: since, lte: until } } }),
    ]);

    const allProductsMeta = await app.prisma.productMeta.findMany({
      where: { storeId },
      select: { id: true, title: true, sku: true, category: true, score: true },
    });

    const metricsAgg = await app.prisma.dailyMetric.groupBy({
      by: ["productId"],
      where: { storeId, date: { gte: since, lte: until } },
      _sum: {
        revenue: true, metaRevenue: true, spend: true,
        impressions: true, clicks: true, conversions: true,
      },
      _avg: { margin: true, velocity: true },
      _count: { date: true },
    });

    const productsWithMetrics   = metricsAgg.length;
    const productsWithNoMetrics = totalProducts - productsWithMetrics;
    const metricMap             = new Map(metricsAgg.map(m => [m.productId, m]));

    const allRows = allProductsMeta.map(p => {
      const m       = metricMap.get(p.id);
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
        rawSums: { revenue: rev, metaRevenue: metaRev, spend: spd, impressions: imp, clicks: clk, conversions: cvt },
        rawAvgs: { margin: m?._avg.margin ?? null, velocity: m?._avg.velocity ?? null },
        computed: {
          roas:           spd > 0 ? metaRev / spd : 0,
          blendedRoas:    spd > 0 && rev > 0 ? rev / spd : null,
          ctr:            imp > 0 ? clk / imp : 0,
          conversionRate: clk > 0 ? cvt / clk : 0,
        },
      };
    });

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

    const paged      = allRows.slice(pageNum * take, (pageNum + 1) * take);
    const totalPages = Math.ceil(allRows.length / take);

    const pageProductIds = paged.map(r => r.productId);
    const latestSnapshots = pageProductIds.length > 0
      ? await app.prisma.dailyMetric.findMany({
          where:    { storeId, productId: { in: pageProductIds } },
          orderBy:  { date: "desc" },
          distinct: ["productId"],
          select:   { productId: true, inventoryLevel: true, blendedRoas: true, date: true },
        })
      : [];
    const snapMap = new Map(latestSnapshots.map(s => [s.productId, s]));
    const items   = paged.map(r => ({ ...r, snapshot: snapMap.get(r.productId) ?? null }));

    return reply.send({
      ok: true,
      store:    { id: store.id, name: store.name, currency: store.currency },
      params:   { range, start: start ?? null, end: end ?? null, sortBy, sortDir, page: pageNum, limit: take },
      dateRange: {
        resolved:  resolvedRange,
        since:     since.toISOString(),
        until:     until.toISOString(),
        sinceDate: since.toISOString().slice(0, 10),
        untilDate: until.toISOString().slice(0, 10),
      },
      stats: { totalProducts, productsWithMetrics, productsWithNoMetrics, totalMetricRows },
      page: pageNum, totalPages, total: allRows.length,
      items,
    });
  });

  /**
   * GET /v1/analytics/products/sku
   *
   * Products Analytics SKU lookup — SCALE plan (or ADMIN) only.
   * Same as /admin/products-debug/sku but ownership-gated.
   */
  app.get("/analytics/products/sku", async (request, reply) => {
    const { storeId, sku, range = "30d", start, end } = request.query as Record<string, string>;

    if (!storeId) return reply.code(400).send({ ok: false, message: "storeId is required" });
    if (!sku?.trim()) return reply.code(400).send({ ok: false, message: "sku is required" });

    const auth = await verifyScaleAndOwnership(app, request, reply, storeId);
    if (!auth) return;

    const store = await app.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, name: true, currency: true },
    });
    if (!store) return reply.code(404).send({ ok: false, message: "Store not found" });

    const { start: since, end: until, range: resolvedRange } = parseRange(range, start, end);

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
        dateRange: { resolved: resolvedRange, since: since.toISOString(), until: until.toISOString(),
                     sinceDate: since.toISOString().slice(0, 10), untilDate: until.toISOString().slice(0, 10) },
        query: sku.trim(), matches: [],
      });
    }

    const productIds  = matchedProducts.map(p => p.id);
    const allDailyRows = await app.prisma.dailyMetric.findMany({
      where: { storeId, productId: { in: productIds }, date: { gte: since, lte: until } },
      orderBy: [{ productId: "asc" }, { date: "desc" }],
      select: {
        productId: true, date: true, revenue: true, metaRevenue: true, spend: true,
        impressions: true, clicks: true, conversions: true, inventoryLevel: true,
        roas: true, ctr: true, conversionRate: true, blendedRoas: true, margin: true, velocity: true,
      },
    });

    const rowsByProduct = new Map<string, typeof allDailyRows>();
    for (const row of allDailyRows) {
      if (!rowsByProduct.has(row.productId)) rowsByProduct.set(row.productId, []);
      rowsByProduct.get(row.productId)!.push(row);
    }

    const matches = matchedProducts.map(p => {
      const rows = rowsByProduct.get(p.id) ?? [];
      let totSpend = 0, totRev = 0, totMetaRev = 0, totImp = 0, totClk = 0, totCvt = 0;
      for (const r of rows) {
        totSpend   += r.spend       ?? 0;
        totRev     += r.revenue     ?? 0;
        totMetaRev += r.metaRevenue ?? 0;
        totImp     += r.impressions ?? 0;
        totClk     += r.clicks      ?? 0;
        totCvt     += r.conversions ?? 0;
      }
      return {
        product: { id: p.id, title: p.title, sku: p.sku ?? null, externalId: p.externalId ?? null,
                   category: p.category ?? null, score: p.score, updatedAt: p.updatedAt },
        rowCount: rows.length,
        dailyRows: rows.map(r => {
          const spd = r.spend ?? 0, metaRev = r.metaRevenue ?? 0, rev = r.revenue ?? 0;
          const imp = r.impressions ?? 0, clk = r.clicks ?? 0, cvt = r.conversions ?? 0;
          return {
            date: r.date.toISOString().slice(0, 10),
            spend: spd, revenue: rev, metaRevenue: metaRev,
            impressions: imp, clicks: clk, conversions: cvt,
            inventoryLevel: r.inventoryLevel ?? null,
            margin: r.margin ?? null, velocity: r.velocity ?? null,
            stored: { roas: r.roas ?? null, ctr: r.ctr ?? null,
                      conversionRate: r.conversionRate ?? null, blendedRoas: r.blendedRoas ?? null },
            computed: {
              roas:           spd > 0 ? metaRev / spd : 0,
              blendedRoas:    spd > 0 && rev > 0 ? rev / spd : null,
              ctr:            imp > 0 ? clk / imp : 0,
              conversionRate: clk > 0 ? cvt / clk : 0,
            },
          };
        }),
        totals: {
          spend: totSpend, revenue: totRev, metaRevenue: totMetaRev,
          impressions: totImp, clicks: totClk, conversions: totCvt,
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
      dateRange: { resolved: resolvedRange, since: since.toISOString(), until: until.toISOString(),
                   sinceDate: since.toISOString().slice(0, 10), untilDate: until.toISOString().slice(0, 10) },
      query: sku.trim(), matches,
    });
  });

  /**
   * GET /v1/analytics/meta
   *
   * Meta Analytics — SCALE plan (or ADMIN) only.
   * Same diagnostic data as /admin/meta-debug but scoped to the authenticated user's store.
   */
  app.get("/analytics/meta", async (request, reply) => {
    const { storeId, adAccountId: selectedAdAccountId } = request.query as { storeId?: string; adAccountId?: string };
    if (!storeId) return reply.code(400).send({ ok: false, message: "storeId is required" });

    const auth = await verifyScaleAndOwnership(app, request, reply, storeId);
    if (!auth) return;

    const connection = await app.prisma.connection.findFirst({
      where: { storeId, provider: "META" },
      select: { id: true, provider: true, scopes: true, expiresAt: true, createdAt: true, updatedAt: true, accessToken: true }
    });

    if (!connection) {
      return reply.send({ ok: true, storeId, connection: null, meta: null, dbProducts: [] });
    }

    const { accessToken, ...connPublic } = connection;
    const now = Date.now();
    const isExpired = connection.expiresAt ? connection.expiresAt.getTime() < now : false;
    const daysUntilExpiry = connection.expiresAt
      ? Math.ceil((connection.expiresAt.getTime() - now) / 86_400_000)
      : null;

    const meResult = await metaGet<{ id: string; name: string }>("/me", accessToken, { fields: "id,name" });

    const adAccountsResult = await metaGet<{ data: Array<{ id: string; account_id: string; name: string; currency: string; timezone_name: string }> }>(
      "/me/adaccounts", accessToken, { fields: "account_id,name,currency,timezone_name", limit: "50" }
    );
    const adAccounts = adAccountsResult.data?.data ?? [];
    const activeAccount = selectedAdAccountId
      ? (adAccounts.find(a => a.id === selectedAdAccountId) ?? adAccounts[0])
      : adAccounts[0];

    let adSets: any[] = [];
    let adSetsError: string | null = null;
    if (activeAccount) {
      const r = await metaGet<{ data: any[] }>(`/${activeAccount.id}/adsets`, accessToken,
        { fields: "id,name,status,promoted_object", limit: "100" });
      adSets = r.data?.data ?? [];
      adSetsError = r.error;
    }

    const catalogIds = new Set<string>();
    for (const adset of adSets) {
      const cid = adset.promoted_object?.product_catalog_id;
      if (cid) catalogIds.add(cid);
    }
    if (catalogIds.size === 0 && activeAccount) {
      const r = await metaGet<{ data: Array<{ id: string }> }>(`/${activeAccount.id}/product_catalogs`, accessToken, { fields: "id", limit: "50" });
      for (const c of r.data?.data ?? []) if (c.id) catalogIds.add(c.id);
    }
    if (catalogIds.size === 0) {
      const bizRes = await metaGet<{ data: Array<{ id: string }> }>("/me/businesses", accessToken, { fields: "id", limit: "20" });
      await Promise.all((bizRes.data?.data ?? []).map(async (biz: any) => {
        const catRes = await metaGet<{ data: Array<{ id: string }> }>(`/${biz.id}/owned_product_catalogs`, accessToken, { fields: "id", limit: "50" });
        for (const c of catRes.data?.data ?? []) if (c.id) catalogIds.add(c.id);
      }));
    }

    const dbProductIndex = await app.prisma.productMeta.findMany({
      where: { storeId },
      select: { id: true, title: true, sku: true, externalId: true },
      take: 200
    });

    const byExternal = new Map<string, { id: string; title: string }>();
    const bySku      = new Map<string, { id: string; title: string }>();
    for (const p of dbProductIndex) {
      if (p.externalId) { byExternal.set(p.externalId, p); const n = norm(p.externalId); if (n) byExternal.set(n, p); }
      if (p.sku)        { bySku.set(p.sku, p);             const n = norm(p.sku);        if (n) bySku.set(n, p);        }
    }
    function norm(v?: string | null): string | null {
      if (!v) return null;
      const digits = v.trim().match(/\d+/g)?.join("") ?? "";
      return digits.length > 0 ? digits : v.trim();
    }
    function lookupProduct(id: string) {
      const n = norm(id);
      return byExternal.get(id) ?? (n ? byExternal.get(n) : undefined) ?? bySku.get(id) ?? (n ? bySku.get(n) : undefined) ?? null;
    }
    function extractSkuFromTitle(title?: string | null): string | null {
      if (!title) return null;
      const m = title.match(/^([^,]+),\s/);
      return m ? m[1].trim() : null;
    }

    const catalogResults: any[] = [];
    for (const catalogId of catalogIds) {
      const r = await metaGet<{ data: Array<{ id: string; retailer_id?: string; name?: string }> }>(
        `/${catalogId}/products`, accessToken, { fields: "id,retailer_id,name", limit: "30" }
      );
      if (r.error) { catalogResults.push({ catalogId, products: [], error: r.error }); continue; }

      const products = (r.data?.data ?? []).map(item => {
        let matchedProduct: { id: string; title: string } | null = null;
        let matchMethod: string | null = null;
        if (item.retailer_id) { matchedProduct = lookupProduct(item.retailer_id); if (matchedProduct) matchMethod = "retailer_id"; }
        if (!matchedProduct) { const sku = extractSkuFromTitle(item.name); if (sku) { matchedProduct = lookupProduct(sku); if (matchedProduct) matchMethod = "title_sku"; } }
        if (!matchedProduct) { matchedProduct = lookupProduct(item.id); if (matchedProduct) matchMethod = "catalog_id"; }
        return { catalogItemId: item.id, retailer_id: item.retailer_id ?? null, name: item.name ?? null,
                 matchedProductId: matchedProduct?.id ?? null, matchedProductTitle: matchedProduct?.title ?? null, matchMethod };
      });
      catalogResults.push({ catalogId, products, error: null });
    }

    const SAMPLE_FIELDS = "impressions,clicks,spend,ctr,purchase_roas,actions,action_values,adset_id,ad_id";
    const SAMPLE_RANGE  = JSON.stringify({
      since: new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10),
      until: new Date().toISOString().slice(0, 10)
    });

    let sampleInsights: any[] = [], sampleInsightsError: string | null = null;
    let sampleProductInsights: any[] = [], sampleProductInsightsError: string | null = null;

    if (activeAccount) {
      const r = await metaGet<{ data: any[] }>(`/${activeAccount.id}/insights`, accessToken,
        { level: "ad", time_range: SAMPLE_RANGE, time_increment: "1", fields: SAMPLE_FIELDS, limit: "5" });
      sampleInsights = r.data?.data ?? []; sampleInsightsError = r.error;
    }
    if (activeAccount && catalogIds.size > 0) {
      const r = await metaGet<{ data: any[] }>(`/${activeAccount.id}/insights`, accessToken,
        { level: "ad", time_range: SAMPLE_RANGE, time_increment: "1", breakdowns: "product_id", fields: SAMPLE_FIELDS, limit: "10" });
      sampleProductInsights = r.data?.data ?? []; sampleProductInsightsError = r.error;
    }

    return reply.send({
      ok: true, storeId,
      connection: { ...connPublic, isExpired, daysUntilExpiry, tokenPreview: `${accessToken.slice(0, 12)}…${accessToken.slice(-6)}` },
      meta: {
        me: meResult.data, meError: meResult.error,
        adAccounts, adAccountsError: adAccountsResult.error,
        activeAccountId: activeAccount?.id ?? null,
        adSets: adSets.slice(0, 50), adSetsError,
        catalogCount: catalogIds.size, catalogs: catalogResults,
        sampleInsights, sampleInsightsError,
        sampleProductInsights, sampleProductInsightsError
      },
      dbProducts: dbProductIndex.slice(0, 50)
    });
  });
}
