import type { PrismaClient } from "@prisma/client";

const META_GRAPH_VERSION = "v19.0";
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

interface MetaInsight {
  /** Catalog item ID — only present when fetched with breakdowns=product_id */
  product_id?: string;
  ad_id?: string;
  adset_id?: string;
  impressions: string;
  clicks: string;
  spend: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
  ctr: string;
  cpc?: string;
  purchase_roas?: Array<{ action_type: string; value: string }>;
  date_start: string;
  date_stop: string;
}

interface MetaAdAccount {
  account_id: string;
  id: string;
}

interface MetaAdSet {
  id: string;
  name: string;
  promoted_object?: { product_item_id?: string; product_catalog_id?: string };
}

interface MetaCatalogProduct {
  id: string;
  retailer_id?: string;
  /** Meta stores titles as "SKU, Product Name" — e.g. "25122, Men's POLO Shirt..." */
  name?: string;
}

type MetaPaging = { cursors?: { after?: string } };

type DateAccum = {
  spend: number;
  metaRevenue: number;
  impressions: number;
  clicks: number;
  purchases: number;
  purchaseRoas: number;
  ctr: number;
};

async function graphFetch<T>(
  path: string,
  accessToken: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${META_GRAPH_BASE}${path}`);
  url.searchParams.set("access_token", accessToken);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta Graph API error ${res.status} on ${path}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Normalise a retailer/external ID for loose matching.
 * Strips non-digit chars from Shopify GIDs: gid://shopify/Product/123 → "123"
 * Leaves plain SKUs untouched: "25122" → "25122"
 */
function normalizeRetailerId(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const digits = trimmed.match(/\d+/g)?.join("") ?? "";
  return digits.length > 0 ? digits : trimmed;
}

/**
 * Meta stores catalog product titles as "SKU, Product Name".
 * e.g. "25122, Men's Short-sleeved POLO Shirt Light Luxury..." → "25122"
 * This lets us match by SKU even when retailer_id isn't the SKU.
 */
function extractSkuFromMetaTitle(title?: string): string | null {
  if (!title) return null;
  const match = title.match(/^([^,]+),\s/);
  return match ? match[1].trim() : null;
}

async function fetchCatalogProducts(
  catalogId: string,
  accessToken: string
): Promise<MetaCatalogProduct[]> {
  const all: MetaCatalogProduct[] = [];
  let after: string | undefined;
  let safety = 0;
  do {
    const res = await graphFetch<{ data: MetaCatalogProduct[]; paging?: MetaPaging }>(
      `/${catalogId}/products`,
      accessToken,
      {
        fields: "id,retailer_id,name",
        limit: "500",
        ...(after ? { after } : {})
      }
    );
    all.push(...(res.data ?? []));
    after = res.paging?.cursors?.after;
    safety += 1;
  } while (after && safety < 50);
  return all;
}

/**
 * runMetaSync
 *
 * Pulls ad insights from the Meta Marketing API and merges them into
 * DailyMetric rows already created by the platform sync (Shopify/WooCommerce).
 *
 * Product matching order (most → least accurate):
 *  1. product_id breakdown  — DPA/catalog ads: Meta catalog item ID
 *                             → retailer_id (or title SKU prefix) → SKU/externalId
 *  2. adset promoted_object → product_item_id → retailer_id → SKU/externalId
 *  3. Proportional fallback — unmatched store-level spend distributed
 *                             across products proportionally by that day's revenue
 *
 * Metrics are written to the actual insight date (date_start), NOT always today.
 */
export async function runMetaSync(
  prisma: PrismaClient,
  data: { storeId: string; accessToken: string; metaAdAccountId?: string | null; metaCatalogId?: string | null }
): Promise<{ adAccounts: number; insightsMatched: number }> {
  const { storeId, accessToken, metaAdAccountId, metaCatalogId } = data;

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const dateRange = JSON.stringify({
    since: since.toISOString().slice(0, 10),
    until: new Date().toISOString().slice(0, 10)
  });

  const INSIGHT_FIELDS = [
    "impressions",
    "clicks",
    "spend",
    "ctr",
    "purchase_roas",
    "actions",
    "action_values",
    "adset_id",
    "ad_id"
  ].join(",");

  // --- Step 1: Get connected ad accounts ---
  const accountsRes = await graphFetch<{ data: MetaAdAccount[] }>(
    "/me/adaccounts",
    accessToken,
    { fields: "account_id,name", limit: "50" }
  );
  // If a specific ad account is pinned for this store, sync only that account
  const adAccounts = (accountsRes.data ?? []).filter(
    (a) => !metaAdAccountId || a.id === metaAdAccountId
  );
  if (adAccounts.length === 0) return { adAccounts: 0, insightsMatched: 0 };

  // --- Build product lookup maps (SKU and externalId) ---
  const productIndex = await prisma.productMeta.findMany({
    where: { storeId },
    select: { id: true, externalId: true, sku: true }
  });

  const byExternal = new Map<string, string>(); // externalId/normalised → productMetaId
  const bySku = new Map<string, string>(); // sku/normalised → productMetaId

  for (const p of productIndex) {
    if (p.externalId) {
      byExternal.set(p.externalId, p.id);
      const norm = normalizeRetailerId(p.externalId);
      if (norm) byExternal.set(norm, p.id);
    }
    if (p.sku) {
      bySku.set(p.sku, p.id);
      const norm = normalizeRetailerId(p.sku);
      if (norm) bySku.set(norm, p.id);
    }
  }

  /** Try to find a ProductMeta ID from any identifier (retailer_id, SKU, externalId). */
  function lookupProduct(identifier: string): string | null {
    const norm = normalizeRetailerId(identifier);
    return (
      byExternal.get(identifier) ??
      (norm ? byExternal.get(norm) : undefined) ??
      bySku.get(identifier) ??
      (norm ? bySku.get(norm) : undefined) ??
      null
    );
  }

  let totalMatched = 0;

  for (const account of adAccounts) {
    try {
      // --- Step 2: Fetch ad sets FIRST to build catalog ID list ---
      const adSetsRes = await graphFetch<{ data: MetaAdSet[] }>(
        `/${account.id}/adsets`,
        accessToken,
        { fields: "id,name,promoted_object", limit: "500" }
      );

      const adSetMap = new Map<string, MetaAdSet>();
      const catalogAdsetIds = new Set<string>(); // adsets linked to a catalog
      const catalogIds = new Set<string>();

      for (const adset of adSetsRes.data ?? []) {
        adSetMap.set(adset.id, adset);
        const catalogId = adset.promoted_object?.product_catalog_id;
        if (catalogId) {
          catalogIds.add(catalogId);
          catalogAdsetIds.add(adset.id);
        }
      }

      // If a catalog is pinned for this store, use it exclusively instead of
      // all catalogs discovered from adsets (faster + avoids cross-brand pollution)
      if (metaCatalogId) {
        catalogIds.clear();
        catalogIds.add(metaCatalogId);
      }

      // --- Step 3: Build catalog item → retailer_id and title-SKU maps ---
      // retailer_id is the store's own identifier (often SKU or Shopify product ID).
      // Meta also stores product titles as "SKU, Product Name" — extract SKU as fallback.
      const catalogItemToRetailer = new Map<string, string>(); // catalogItemId → retailer_id
      const catalogItemToTitleSku = new Map<string, string>(); // catalogItemId → SKU from title

      for (const catalogId of catalogIds) {
        try {
          const items = await fetchCatalogProducts(catalogId, accessToken);
          for (const item of items) {
            if (!item.id) continue;
            if (item.retailer_id) {
              catalogItemToRetailer.set(item.id, item.retailer_id);
            }
            // "25122, Men's Short-sleeved POLO Shirt..." → "25122"
            const skuFromTitle = extractSkuFromMetaTitle(item.name);
            if (skuFromTitle) {
              catalogItemToTitleSku.set(item.id, skuFromTitle);
            }
          }
        } catch (err) {
          console.error(`Meta catalog fetch failed for ${catalogId}:`, err);
        }
      }

      /**
       * Look up a product using a Meta catalog item ID.
       * Tries: retailer_id → title SKU prefix → raw catalog ID itself.
       */
      function lookupByCatalogItem(catalogItemId: string): string | null {
        // 1. retailer_id (the store's own product identifier)
        const retailerId = catalogItemToRetailer.get(catalogItemId);
        if (retailerId) {
          const found = lookupProduct(retailerId);
          if (found) return found;
        }
        // 2. SKU extracted from Meta's "SKU, Title" product name format
        const titleSku = catalogItemToTitleSku.get(catalogItemId);
        if (titleSku) {
          const found = lookupProduct(titleSku);
          if (found) return found;
        }
        // 3. Treat the catalog item ID itself as an externalId/SKU (rare but possible)
        return lookupProduct(catalogItemId);
      }

      // --- Step 4a: Product-level insights (DPA / Advantage+ Catalog campaigns) ---
      // breakdowns=product_id splits metrics per product per day.
      // This is what Meta Ads Manager shows in "breakdown by Product ID" view.
      let productInsights: MetaInsight[] = [];
      if (catalogIds.size > 0) {
        try {
          const res = await graphFetch<{ data: MetaInsight[] }>(
            `/${account.id}/insights`,
            accessToken,
            {
              level: "ad",
              time_range: dateRange,
              time_increment: "1", // one row per day
              breakdowns: "product_id", // one row per product
              fields: INSIGHT_FIELDS,
              limit: "500"
            }
          );
          productInsights = res.data ?? [];
        } catch {
          // Product breakdown unsupported on this account — fall through to regular insights
        }
      }

      // --- Step 4b: Regular insights (no product breakdown, non-catalog adsets only) ---
      // Fetched separately to avoid double-counting catalog campaign spend.
      const allInsightsRes = await graphFetch<{ data: MetaInsight[] }>(
        `/${account.id}/insights`,
        accessToken,
        {
          level: "ad",
          time_range: dateRange,
          time_increment: "1",
          fields: INSIGHT_FIELDS,
          limit: "500"
        }
      );

      // Keep only non-catalog adsets here — catalog adsets are covered by productInsights
      const regularInsights = (allInsightsRes.data ?? []).filter(
        (i) => !i.adset_id || !catalogAdsetIds.has(i.adset_id)
      );

      // --- Step 5: Process insights in order (product-level first = more accurate) ---
      // Track written (productId, date) keys to prevent double-counting.
      const writtenKeys = new Set<string>();
      // Accumulate unmatched spend by date before proportional distribution.
      const unmatchedAccum = new Map<string, DateAccum>();

      const insightBatches = [productInsights, regularInsights];

      for (const batch of insightBatches) {
        for (const insight of batch) {
          const purchases = (insight.actions ?? [])
            .filter((a) => a.action_type === "purchase")
            .reduce((sum, a) => sum + parseFloat(a.value), 0);

          const purchaseValue = (insight.action_values ?? [])
            .filter((a) => a.action_type.includes("purchase"))
            .reduce((sum, a) => sum + parseFloat(a.value), 0);

          const purchaseRoas = insight.purchase_roas?.[0]
            ? parseFloat(insight.purchase_roas[0].value)
            : 0;

          const spend = parseFloat(insight.spend);
          const impressions = parseInt(insight.impressions, 10);
          const clicks = parseInt(insight.clicks, 10);
          const ctr = parseFloat(insight.ctr) / 100;
          // metaRevenue: prefer action_values (actual conversion value), fall back to ROAS calc
          const metaRevenue =
            purchaseValue > 0 ? purchaseValue : purchaseRoas > 0 ? spend * purchaseRoas : 0;

          if (spend === 0) continue;

          // Write to the actual date this insight covers, NOT today
          const insightDate = new Date(insight.date_start);
          insightDate.setHours(0, 0, 0, 0);

          let productMetaId: string | null = null;

          // Method 1: product_id from breakdown (Meta catalog item ID)
          if (insight.product_id) {
            productMetaId = lookupByCatalogItem(insight.product_id);
          }

          // Method 2: adset promoted_object.product_item_id (single-product linked ads)
          if (!productMetaId && insight.adset_id) {
            const adset = adSetMap.get(insight.adset_id);
            const itemId = adset?.promoted_object?.product_item_id;
            if (itemId) {
              productMetaId = lookupByCatalogItem(itemId);
            }
          }

          // Method 3: accumulate unmatched spend for proportional distribution later
          if (!productMetaId) {
            const dk = insightDate.toISOString();
            const acc = unmatchedAccum.get(dk) ?? {
              spend: 0,
              metaRevenue: 0,
              impressions: 0,
              clicks: 0,
              purchases: 0,
              purchaseRoas: 0,
              ctr: 0
            };
            unmatchedAccum.set(dk, {
              spend: acc.spend + spend,
              metaRevenue: acc.metaRevenue + metaRevenue,
              impressions: acc.impressions + impressions,
              clicks: acc.clicks + clicks,
              purchases: acc.purchases + purchases,
              purchaseRoas: purchaseRoas || acc.purchaseRoas,
              ctr: ctr || acc.ctr
            });
            continue;
          }

          // Skip if already written (product breakdown wins over regular insights)
          const writeKey = `${productMetaId}:${insightDate.toISOString()}`;
          if (writtenKeys.has(writeKey)) continue;
          writtenKeys.add(writeKey);

          const existingMetric = await prisma.dailyMetric.findUnique({
            where: { storeId_productId_date: { storeId, productId: productMetaId, date: insightDate } }
          });

          const revenue = existingMetric?.revenue ?? 0;
          const blendedRoas = revenue > 0 && spend > 0 ? revenue / spend : purchaseRoas;

          await prisma.dailyMetric.upsert({
            where: { storeId_productId_date: { storeId, productId: productMetaId, date: insightDate } },
            create: {
              date: insightDate,
              roas: purchaseRoas,
              blendedRoas,
              ctr,
              conversionRate: clicks > 0 ? purchases / clicks : 0,
              margin: existingMetric?.margin ?? 0.35,
              velocity: revenue / 30,
              spend,
              revenue,
              metaRevenue,
              impressions,
              clicks,
              conversions: Math.round(purchases),
              storeId,
              productId: productMetaId
            },
            update: {
              roas: purchaseRoas,
              blendedRoas,
              ctr,
              spend,
              metaRevenue,
              impressions,
              clicks,
              conversions: Math.round(purchases),
              conversionRate: clicks > 0 ? purchases / clicks : 0
            }
          });

          totalMatched++;
        }
      }

      // --- Step 6: Proportional distribution of unmatched spend ---
      // For ads we couldn't attribute to a specific product, split spend
      // across products proportionally based on each product's store revenue that day.
      for (const [dateKey, accum] of unmatchedAccum) {
        const insightDate = new Date(dateKey);

        const products = await prisma.productMeta.findMany({
          where: { storeId },
          include: {
            dailyMetrics: { where: { date: insightDate }, take: 1 }
          }
        });

        const totalRevenue = products.reduce(
          (sum, p) => sum + (p.dailyMetrics[0]?.revenue ?? 0),
          0
        );

        if (totalRevenue === 0) continue;

        for (const product of products) {
          const productRevenue = product.dailyMetrics[0]?.revenue ?? 0;
          if (productRevenue === 0) continue;

          const writeKey = `${product.id}:${insightDate.toISOString()}`;
          if (writtenKeys.has(writeKey)) continue; // matched insight already wrote this slot

          const share = productRevenue / totalRevenue;
          const pSpend = accum.spend * share;
          const pImpressions = Math.round(accum.impressions * share);
          const pClicks = Math.round(accum.clicks * share);
          const blendedRoas = pSpend > 0 ? productRevenue / pSpend : accum.purchaseRoas;

          await prisma.dailyMetric.upsert({
            where: { storeId_productId_date: { storeId, productId: product.id, date: insightDate } },
            create: {
              date: insightDate,
              roas: accum.purchaseRoas,
              blendedRoas,
              ctr: accum.ctr,
              conversionRate: pClicks > 0 ? (accum.purchases * share) / pClicks : 0,
              margin: product.dailyMetrics[0]?.margin ?? 0.35,
              velocity: productRevenue / 30,
              spend: pSpend,
              revenue: productRevenue,
              metaRevenue: accum.metaRevenue * share,
              impressions: pImpressions,
              clicks: pClicks,
              conversions: Math.round(accum.purchases * share),
              storeId,
              productId: product.id
            },
            update: {
              roas: accum.purchaseRoas,
              blendedRoas,
              ctr: accum.ctr,
              spend: pSpend,
              metaRevenue: accum.metaRevenue * share,
              impressions: pImpressions,
              clicks: pClicks,
              conversions: Math.round(accum.purchases * share),
              conversionRate: pClicks > 0 ? (accum.purchases * share) / pClicks : 0
            }
          });

          writtenKeys.add(writeKey);
          totalMatched++;
        }
      }
    } catch (err) {
      // Don't fail the whole sync if one ad account errors
      console.error(`Meta sync error for account ${account.account_id}:`, err);
    }
  }

  return { adAccounts: adAccounts.length, insightsMatched: totalMatched };
}
