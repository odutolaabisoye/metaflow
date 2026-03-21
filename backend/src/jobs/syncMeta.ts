import type { PrismaClient } from "@prisma/client";
import { storeLocalDayBounds } from "./dateUtils.js";
import { fetchWithRetry } from "../utils/http.js";

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
  addToCart: number;
  addToCartOmni: number;
  checkoutInitiated: number;
  checkoutInitiatedOmni: number;
};

/**
 * Meta rate-limit error codes.
 * When any of these are returned, we back off and retry rather than failing.
 *   4  — Application request limit reached
 *   17 — User request limit reached
 *   32 — Page rate limit
 *   613 — Custom audiences rate limit
 *   80000–80003 — Business Use Case (BUC / Marketing API) rate limits
 */
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80000, 80001, 80002, 80003]);

/**
 * Meta auth / permission error codes.
 * These require the user to reconnect — retrying will never help.
 *   190 — Invalid OAuth 2.0 access token (expired or revoked)
 *   102 — Session key invalid or no longer valid
 *   10  — Application does not have permission for this action
 *   200 — Permissions error
 *   210 — User not visible
 */
const AUTH_ERROR_CODES = new Set([10, 102, 190, 200, 210]);

/**
 * Thrown when Meta returns an auth/permission error code.
 * The worker catches this specifically and writes lastSyncStatus = "NEEDS_REAUTH"
 * instead of "ERROR" so the frontend can prompt the user to reconnect.
 */
export class MetaAuthError extends Error {
  code: number;
  constructor(message: string, code: number) {
    super(message);
    this.name = "MetaAuthError";
    this.code = code;
  }
}

function parseMetaError(body: string): { code: number; message: string } {
  try {
    const parsed = JSON.parse(body);
    return {
      code:    parsed?.error?.code    ?? parsed?.code    ?? 0,
      message: parsed?.error?.message ?? parsed?.message ?? body,
    };
  } catch {
    return { code: 0, message: body };
  }
}

function isRateLimit(errorBody: string): { limited: boolean; retryAfterMs: number } {
  const { code, message } = parseMetaError(errorBody);
  if (RATE_LIMIT_CODES.has(code)) {
    const match = message.match(/retry[^0-9]*(\d+)\s*second/i);
    const retryAfterMs = match ? parseInt(match[1], 10) * 1000 : 20_000;
    return { limited: true, retryAfterMs };
  }
  return { limited: false, retryAfterMs: 0 };
}

async function graphFetch<T>(
  path: string,
  accessToken: string,
  params: Record<string, string> = {},
  attempt = 0
): Promise<T> {
  const url = new URL(`${META_GRAPH_BASE}${path}`);
  url.searchParams.set("access_token", accessToken);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    const { code, message } = parseMetaError(body);

    // Auth/permission errors — no point retrying, user must reconnect
    if (AUTH_ERROR_CODES.has(code)) {
      throw new MetaAuthError(`Meta auth error (${code}): ${message}`, code);
    }

    // Retry on rate limit — up to 3 attempts with the delay Meta specifies
    if (attempt < 3) {
      const { limited, retryAfterMs } = isRateLimit(body);
      if (limited) {
        const wait = retryAfterMs + attempt * 5_000; // add 5s per attempt for safety
        console.warn(`[syncMeta] Rate limited on ${path}, waiting ${wait}ms (attempt ${attempt + 1})`);
        await new Promise(r => setTimeout(r, wait));
        return graphFetch<T>(path, accessToken, params, attempt + 1);
      }
    }

    throw new Error(`Meta Graph API error ${res.status} on ${path}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Fetches ALL pages of a paginated Meta Graph endpoint using cursor-based pagination.
 * Handles the `paging.cursors.after` pattern used by ads/insights endpoints.
 * Safety limit of 200 pages prevents infinite loops.
 */
async function graphFetchAllPages<T>(
  path: string,
  accessToken: string,
  params: Record<string, string> = {}
): Promise<T[]> {
  const all: T[] = [];
  let after: string | undefined;
  let safety = 0;
  do {
    const res = await graphFetch<{ data: T[]; paging?: MetaPaging }>(
      path,
      accessToken,
      { ...params, ...(after ? { after } : {}) }
    );
    all.push(...(res.data ?? []));
    after = res.paging?.cursors?.after;
    safety += 1;
  } while (after && safety < 200);
  return all;
}

/** Format a local Date as YYYY-MM-DD without UTC conversion. */
function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Extract purchase conversion count from Meta actions array.
 *
 * Meta returns many overlapping action types for the same purchase event
 * (pixel, onsite/Facebook Shops, omni, app). Summing them causes massive
 * over-counting. Use a priority list and take the FIRST non-zero value.
 *
 * Priority:
 *  1. offsite_conversion.fb_pixel_purchase  — standard pixel (traditional e-commerce)
 *  2. onsite_web_purchase                   — Facebook/Instagram Shops checkout
 *  3. omni_purchase                         — Meta's unified cross-channel count
 *  4. purchase                              — generic fallback
 */
function pickPurchaseCount(actions: Array<{ action_type: string; value: string }>): number {
  // Priority order matters critically for DPA product-breakdown rows.
  //
  // omni_purchase is Meta's canonical, deduplicated, product-attributed metric.
  // When a customer clicks an ad for product A but buys product B through Meta's
  // onsite checkout, omni_purchase = 0 for product A's row while onsite_web_purchase = 1.
  // Putting omni_purchase first ensures we only count purchases actually attributed
  // to THIS specific product, not session-level purchases of a different product.
  //
  // offsite_conversion.fb_pixel_purchase covers traditional pixel-tracked purchases
  // (standard WooCommerce/Shopify checkout with pixel firing).
  //
  // onsite_web_purchase is a session-level metric — it fires when ANY purchase
  // happens in a session where this ad was shown, regardless of which product
  // was bought. It must come LAST to avoid mis-attributing cross-product purchases.
  const priority = [
    "omni_purchase",
    "offsite_conversion.fb_pixel_purchase",
    "onsite_web_purchase",
    "purchase",
  ];
  for (const type of priority) {
    const found = actions.find((a) => a.action_type === type);
    if (found) {
      const v = parseFloat(found.value);
      if (v > 0) return v;
    }
  }
  return 0;
}

/**
 * Extract purchase revenue from Meta action_values array.
 *
 * Priority mirrors pickPurchaseCount — omni_purchase first so we only capture
 * revenue genuinely attributed to THIS product, not the full order value of a
 * different product bought in the same session after clicking this ad.
 *
 * Example: customer clicks Off-White Polo DPA ad, buys a different item for
 * ₦111,500. Meta sets omni_purchase=0 and onsite_web_purchase=1 with
 * action_values[onsite_web_purchase]=111500. Old order (onsite_web_purchase first)
 * would store ₦111,500 as this product's metaRevenue — wrong. New order returns 0.
 */
function pickPurchaseValue(actionValues: Array<{ action_type: string; value: string }>): number {
  const priority = [
    "omni_purchase",
    "offsite_conversion.fb_pixel_purchase",
    "onsite_web_purchase",
    "purchase",
  ];
  for (const type of priority) {
    const found = actionValues.find((a) => a.action_type === type);
    if (found) {
      const v = parseFloat(found.value);
      if (v > 0) return v;
    }
  }
  return 0;
}

/**
 * Extract a single action count from Meta's actions array by exact action_type.
 * Returns 0 if not found or value is non-numeric.
 */
function getActionCount(actions: Array<{ action_type: string; value: string }>, type: string): number {
  const found = actions.find(a => a.action_type === type);
  return found ? Math.round(parseFloat(found.value) || 0) : 0;
}

/**
 * Normalise a retailer/external ID for loose matching.
 * - Shopify GIDs: gid://shopify/Product/123 → "123"
 * - Pure numeric IDs: "25122" → "25122"
 * - Alphanumeric SKUs: "SKU-25122-A" → "SKU-25122-A" (preserve)
 */
function normalizeRetailerId(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Shopify GID
  if (trimmed.startsWith("gid://shopify/")) {
    const digits = trimmed.match(/\d+/g)?.join("") ?? "";
    return digits.length > 0 ? digits : trimmed;
  }
  // Pure numeric IDs (WooCommerce/Shopify numeric product/variant IDs)
  if (/^\d+$/.test(trimmed)) return trimmed;
  // Preserve alphanumeric SKUs
  return trimmed;
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

function normalizeTitle(value?: string): string | null {
  if (!value) return null;
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  data: {
    storeId: string;
    accessToken: string;
    metaAdAccountId?: string | null;
    metaCatalogId?: string | null;
    /** How many days back to sync. Defaults to 90 to cover the max frontend range. */
    sinceDays?: number;
    /** IANA timezone for this store — used to align insight dates with WooCommerce/Shopify DailyMetric rows. */
    timezone?: string;
  }
): Promise<{ adAccounts: number; insightsMatched: number; unmatchedCatalogItems: number }> {
  const { storeId, accessToken, metaAdAccountId, metaCatalogId, sinceDays = 90, timezone = "Africa/Lagos" } = data;

  // Use local date strings to avoid UTC off-by-one errors
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - sinceDays);
  const dateRange = JSON.stringify({
    since: toLocalDateStr(sinceDate),
    until: toLocalDateStr(new Date())
  });

  // DPA product breakdown generates far more rows (per product × per day × per ad).
  // Meta times out on 90-day windows — cap at 30 days for the breakdown call.
  const DPA_DAYS = 30;
  const dpaSinceDate = new Date();
  dpaSinceDate.setDate(dpaSinceDate.getDate() - DPA_DAYS);
  const dpaDateRange = JSON.stringify({
    since: toLocalDateStr(dpaSinceDate),
    until: toLocalDateStr(new Date())
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
  if (adAccounts.length === 0) return { adAccounts: 0, insightsMatched: 0, unmatchedCatalogItems: 0 };

  // --- Build product lookup maps (SKU, externalId, and altIds) ---
  const productIndex = await prisma.productMeta.findMany({
    where: { storeId, isActive: true },
    select: { id: true, externalId: true, sku: true, altIds: true, title: true }
  });

  const byExternal = new Map<string, string>(); // externalId/normalised/altId → productMetaId
  const bySku = new Map<string, string>(); // sku/normalised → productMetaId
  const byTitle = new Map<string, string>(); // normalized title → productMetaId

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
    // Index all variant / variation IDs (Shopify variant IDs, WooCommerce variation IDs).
    // Meta catalogs report at the variant level, so their retailer_id or product_id
    // is often a variant ID rather than the parent product ID.
    for (const altId of p.altIds) {
      if (!byExternal.has(altId)) {
        byExternal.set(altId, p.id);
      }
      const norm = normalizeRetailerId(altId);
      if (norm && !byExternal.has(norm)) byExternal.set(norm, p.id);
    }

    const normTitle = normalizeTitle(p.title);
    if (normTitle) byTitle.set(normTitle, p.id);
  }

  /** Try to find a ProductMeta ID from any identifier (retailer_id, SKU, externalId). */
  function lookupProduct(identifier: string): string | null {
    const norm = normalizeRetailerId(identifier);
    const matched =
      byExternal.get(identifier) ??
      (norm ? byExternal.get(norm) : undefined) ??
      bySku.get(identifier) ??
      (norm ? bySku.get(norm) : undefined) ??
      null;
    if (matched) return matched;

    const normTitle = normalizeTitle(identifier);
    return (
      (normTitle ? byTitle.get(normTitle) : undefined) ??
      null
    );
  }

  let totalMatched = 0;

  // Accumulated across all ad accounts — maps retailer_id → { name, catalogItemId }
  // for every Meta catalog product that could not be matched to a WooCommerce/Shopify product.
  // Written to the audit log once, after all accounts are processed, so merchants
  // can see exactly which catalog entries need to be cleaned up or corrected.
  const unmatchedCatalogItems = new Map<string, { name: string; catalogItemId: string }>();

  // Fetch the store's operating currency so we can convert Meta spend values
  // when the ad account bills in a different currency (e.g. NGN vs USD).
  const storeRecord = await prisma.store.findUnique({
    where: { id: storeId },
    select: { currency: true }
  });
  const storeCurrency = (storeRecord?.currency ?? 'USD').toUpperCase();

  for (const account of adAccounts) {
    try {
      const matchedBefore = totalMatched;
      // --- Step 1b: Fetch account billing currency for spend conversion ---
      // Meta returns spend/revenue in the ad account's billing currency, which may
      // differ from the store's operating currency (e.g. NGN ad account vs USD store).
      // We fetch a live exchange rate and apply it to all monetary values before writing.
      let spendMultiplier = 1.0;
      try {
        const acctDetails = await graphFetch<{ currency?: string }>(
          `/${account.id}`,
          accessToken,
          { fields: 'currency' }
        );
        const acctCurrency = (acctDetails.currency ?? storeCurrency).toUpperCase();
        if (acctCurrency !== storeCurrency) {
          const ratesRes = await fetchWithRetry(
            `https://open.er-api.com/v6/latest/${acctCurrency}`
          );
          if (ratesRes.ok) {
            const ratesJson = await ratesRes.json() as { rates?: Record<string, number> };
            const rate = ratesJson.rates?.[storeCurrency];
            if (rate && rate > 0) {
              spendMultiplier = rate;
              console.log(
                `[syncMeta] account=${account.account_id} currency=${acctCurrency}→${storeCurrency} rate=${spendMultiplier.toFixed(6)}`
              );
            }
          }
        }
      } catch {
        console.warn(
          `[syncMeta] Could not fetch currency for account ${account.account_id}, using 1:1`
        );
      }

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

      // --- Step 3: Build catalog item → retailer_id, title-SKU, and full name maps ---
      // retailer_id is the store's own identifier (often SKU or Shopify product ID).
      // Meta also stores product titles as "SKU, Product Name" — extract SKU as fallback.
      const catalogItemToRetailer = new Map<string, string>(); // catalogItemId → retailer_id
      const catalogItemToTitleSku = new Map<string, string>(); // catalogItemId → SKU from title
      const catalogItemToName     = new Map<string, string>(); // catalogItemId → full product name

      for (const catalogId of catalogIds) {
        try {
          const items = await fetchCatalogProducts(catalogId, accessToken);
          for (const item of items) {
            if (!item.id) continue;
            if (item.retailer_id) {
              catalogItemToRetailer.set(item.id, item.retailer_id);
            }
            if (item.name) {
              catalogItemToName.set(item.id, item.name);
              // "25122, Men's Short-sleeved POLO Shirt..." → "25122"
              const skuFromTitle = extractSkuFromMetaTitle(item.name);
              if (skuFromTitle) {
                catalogItemToTitleSku.set(item.id, skuFromTitle);
              }
            }
          }
        } catch (err) {
          console.error(`Meta catalog fetch failed for ${catalogId}:`, err);
        }
      }

      /**
       * Title-similarity matching: compares the Meta product name against all
       * WooCommerce product titles in the index using word overlap scoring.
       * Used as a last-resort after all ID/SKU strategies fail.
       * Requires ≥60% meaningful word overlap (words longer than 3 chars).
       */
      function matchByTitleSimilarity(metaName: string): string | null {
        const normMeta = normalizeTitle(metaName);
        if (!normMeta) return null;
        const metaWords = normMeta.split(" ").filter(w => w.length > 3);
        if (metaWords.length < 2) return null; // too short for reliable matching
        const metaSet = new Set(metaWords);

        let bestScore = 0;
        let bestId: string | null = null;
        for (const [normTitle, productId] of byTitle) {
          const wcWords = normTitle.split(" ").filter(w => w.length > 3);
          if (wcWords.length === 0) continue;
          const matches = wcWords.filter(w => metaSet.has(w)).length;
          const score = matches / Math.max(metaSet.size, wcWords.length);
          if (score >= 0.6 && score > bestScore) {
            bestScore = score;
            bestId = productId;
          }
        }
        return bestId;
      }

      /**
       * Look up a product using a Meta catalog item ID.
       * Matching order (most → least reliable):
       *  1. retailer_id exact match (SKU or WooCommerce/Shopify product/variant ID)
       *  2. SKU prefix extracted from "SKU, Product Name" title format
       *  3. Catalog item ID itself (as an externalId/SKU — rare but possible)
       *  4. Title similarity (word overlap ≥60%) — last resort
       */
      function lookupByCatalogItem(catalogItemId: string): { id: string; method: string } | null {
        // 1. retailer_id (the store's own product identifier)
        const retailerId = catalogItemToRetailer.get(catalogItemId);
        if (retailerId) {
          const found = lookupProduct(retailerId);
          if (found) return { id: found, method: "retailer_id" };
        }
        // 2. SKU extracted from Meta's "SKU, Title" product name format
        const titleSku = catalogItemToTitleSku.get(catalogItemId);
        if (titleSku) {
          const found = lookupProduct(titleSku);
          if (found) return { id: found, method: "title_sku" };
        }
        // 3. Treat the catalog item ID itself as an externalId/SKU (rare but possible)
        const byId = lookupProduct(catalogItemId);
        if (byId) return { id: byId, method: "catalog_item_id" };

        // 4. Title similarity fallback — handles slight name differences
        const metaName = catalogItemToName.get(catalogItemId);
        if (metaName) {
          const found = matchByTitleSimilarity(metaName);
          if (found) return { id: found, method: "title_similarity" };

          // Record as unmatched so it can be surfaced to the merchant
          const retailerIdForLog = retailerId ?? catalogItemId;
          unmatchedCatalogItems.set(retailerIdForLog, { name: metaName, catalogItemId });
        }
        return null;
      }

      // --- Step 4a: Product-level insights (DPA / Advantage+ Catalog campaigns) ---
      // breakdowns=product_id splits metrics per product per day.
      // This is what Meta Ads Manager shows in "breakdown by Product ID" view.
      // Uses full pagination — accounts with many products/days can exceed 500 records.
      let productInsights: MetaInsight[] = [];
      let productBreakdownSucceeded = false;
      if (catalogIds.size > 0) {
        // Meta times out on large DPA breakdown requests. Fetch in 7-day chunks
        // to stay within API limits (matches what works in manual Postman calls).
        const chunks: Array<{ since: string; until: string }> = [];
        const chunkEnd = new Date();
        for (let i = 0; i < DPA_DAYS; i += 7) {
          const until = new Date(chunkEnd);
          until.setDate(until.getDate() - i);
          const since = new Date(chunkEnd);
          since.setDate(since.getDate() - Math.min(i + 6, DPA_DAYS - 1));
          chunks.push({ since: toLocalDateStr(since), until: toLocalDateStr(until) });
        }

        for (const chunk of chunks) {
          try {
            const chunkInsights = await graphFetchAllPages<MetaInsight>(
              `/${account.id}/insights`,
              accessToken,
              {
                level: "ad",
                time_range: JSON.stringify(chunk),
                time_increment: "1",
                breakdowns: "product_id",
                fields: INSIGHT_FIELDS,
                limit: "500"
              }
            );
            productInsights.push(...chunkInsights);
            console.log(`[syncMeta] DPA chunk ${chunk.since}→${chunk.until}: ${chunkInsights.length} rows`);
          } catch (err) {
            console.warn(`[syncMeta] DPA chunk ${chunk.since}→${chunk.until} failed:`, (err as Error).message);
          }
        }
        productBreakdownSucceeded = productInsights.length > 0;
        console.log(`[syncMeta] DPA product breakdown total: ${productInsights.length} rows`);
      }

      // --- Step 4b: Regular insights (no product breakdown, non-catalog adsets only) ---
      // Fetched separately to avoid double-counting catalog campaign spend.
      // Uses full pagination — 90 days × many ads easily exceeds 500 records.
      const allInsights = await graphFetchAllPages<MetaInsight>(
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
      console.log(`[syncMeta] Regular insights: ${allInsights.length} rows`);

      // Exclude catalog adsets from regular insights ONLY if the DPA breakdown
      // actually returned data. If DPA breakdown failed or returned empty, keeping
      // catalog adsets in regular insights is better than losing all spend entirely.
      const regularInsights = productBreakdownSucceeded
        ? allInsights.filter((i) => !i.adset_id || !catalogAdsetIds.has(i.adset_id))
        : allInsights;
      console.log(`[syncMeta] Regular insights after filter: ${regularInsights.length} rows (DPA succeeded: ${productBreakdownSucceeded})`);

      // --- Step 5: Accumulate insights per (product, date), then batch-upsert ---
      //
      // The same product frequently appears across multiple campaigns on the same date
      // (e.g. "Prospecting CRO" + "Prospecting Many Cat" both running product 65131).
      // We MUST sum all rows rather than writing only the first match.
      //
      // Priority: productInsights (catalog DPA breakdown) take precedence over
      // regularInsights. Once a (product, date) pair has a product-breakdown row,
      // regular insight spend is NOT added on top (avoids double-counting catalog adsets).
      //
      // Monetary values (spend, metaRevenue) are multiplied by spendMultiplier to convert
      // from the Meta ad account's billing currency into the store's operating currency.

      // Accumulate unmatched spend by date for proportional distribution (Step 6).
      const unmatchedAccum = new Map<string, DateAccum>();

      // Per-(product, date) accumulator. Key: "productMetaId\x00dateISO"
      const productDateAccum = new Map<string, {
        productMetaId: string;
        insightDate: Date;
        spend: number;
        metaRevenue: number;
        impressions: number;
        clicks: number;
        purchases: number;
        purchaseRoas: number;
        addToCart: number;
        addToCartOmni: number;
        checkoutInitiated: number;
        checkoutInitiatedOmni: number;
        source: 'product' | 'regular';
      }>();

      const insightBatches: [MetaInsight[], 'product' | 'regular'][] = [
        [productInsights, 'product'],
        [regularInsights, 'regular'],
      ];

      const matchCounts: Record<string, number> = {};

      for (const [batch, source] of insightBatches) {
        for (const insight of batch) {
          // Use priority-based helpers to avoid double-counting onsite/pixel/omni
          // purchase events that Meta reports as separate action types for the same transaction.
          const purchases = pickPurchaseCount(insight.actions ?? []);
          const purchaseValue = pickPurchaseValue(insight.action_values ?? []);

          // purchase_roas from Meta is often for "omni_purchase" which can be 0 even when
          // onsite purchases exist. Compute ROAS ourselves from purchaseValue/spend instead.
          const purchaseRoas = purchaseValue > 0 && parseFloat(insight.spend) > 0
            ? purchaseValue / parseFloat(insight.spend)
            : (() => {
                // Fall back to whichever purchase_roas entry is non-zero
                const roasEntry = (insight.purchase_roas ?? []).find(
                  (r) => parseFloat(r.value) > 0
                );
                return roasEntry ? parseFloat(roasEntry.value) : 0;
              })();

          // Apply currency conversion: Meta billing currency → store operating currency
          const rawSpend = parseFloat(insight.spend);
          const spend = rawSpend * spendMultiplier;
          const impressions = parseInt(insight.impressions, 10);
          const clicks = parseInt(insight.clicks, 10);
          // metaRevenue: prefer action_values (actual conversion value), fall back to ROAS × spend.
          // Both purchaseValue and the ROAS-derived amount are in Meta billing currency, so
          // multiply by spendMultiplier to get store currency.
          const rawMetaRevenue =
            purchaseValue > 0 ? purchaseValue : purchaseRoas > 0 ? rawSpend * purchaseRoas : 0;
          const metaRevenue = rawMetaRevenue * spendMultiplier;

          const addToCart           = getActionCount(insight.actions ?? [], 'add_to_cart');
          const addToCartOmni       = getActionCount(insight.actions ?? [], 'omni_add_to_cart');
          const checkoutInitiated    = getActionCount(insight.actions ?? [], 'initiated_checkout');
          const checkoutInitiatedOmni = getActionCount(insight.actions ?? [], 'omni_initiated_checkout');

          if (spend === 0) continue;

          // Convert "YYYY-MM-DD" insight date to the store's local midnight in UTC.
          // This MUST match how WooCommerce/Shopify syncs write their DailyMetric rows
          // (both now use storeLocalDayBounds). Using UTC midnight here caused revenue
          // and spend to land on DIFFERENT rows, breaking ROAS calculation.
          // Using noon (T12:00:00Z) as the probe avoids DST-boundary edge cases.
          const insightDate = storeLocalDayBounds(timezone, new Date(`${insight.date_start}T12:00:00Z`)).start;

          let productMetaId: string | null = null;
          let matchMethod = "none";

          // Method 1: product_id from breakdown (Meta catalog item ID)
          if (insight.product_id) {
            const match = lookupByCatalogItem(insight.product_id);
            if (match) {
              productMetaId = match.id;
              matchMethod = match.method;
            }

            // If Meta product_id looks like "SKU, Title" (e.g. "34523, Men's Polo"),
            // extract the SKU prefix and try matching by SKU / externalId.
            if (!productMetaId && insight.product_id.includes(",")) {
              const skuFromTitle = extractSkuFromMetaTitle(insight.product_id);
              if (skuFromTitle) {
                productMetaId = lookupProduct(skuFromTitle);
                if (productMetaId) matchMethod = "sku_from_product_id";
              }
              if (!productMetaId) {
                const titlePart = insight.product_id.split(",").slice(1).join(",").trim();
                if (titlePart) {
                  productMetaId = lookupProduct(titlePart);
                  if (productMetaId) matchMethod = "title_from_product_id";
                }
              }
            }

            if (!productMetaId) {
              console.warn(
                `[syncMeta] No match for product_id="${insight.product_id}" ` +
                `(extracted SKU: "${extractSkuFromMetaTitle(insight.product_id)}") ` +
                `date=${insight.date_start} spend=${insight.spend}`
              );
            }
          }

          // Method 2: adset promoted_object.product_item_id (single-product linked ads)
          if (!productMetaId && insight.adset_id) {
            const adset = adSetMap.get(insight.adset_id);
            const itemId = adset?.promoted_object?.product_item_id;
            if (itemId) {
              const match = lookupByCatalogItem(itemId);
              if (match) {
                productMetaId = match.id;
                matchMethod = `adset_${match.method}`;
              }
            }
          }

          // Unmatched: accumulate for proportional distribution in Step 6
          if (!productMetaId) {
            const dk = insightDate.toISOString();
            const acc = unmatchedAccum.get(dk) ?? {
              spend: 0, metaRevenue: 0, impressions: 0, clicks: 0,
              purchases: 0, purchaseRoas: 0, ctr: 0,
              addToCart: 0, addToCartOmni: 0, checkoutInitiated: 0, checkoutInitiatedOmni: 0,
            };
            const ctr = parseFloat(insight.ctr) / 100;
            unmatchedAccum.set(dk, {
              spend: acc.spend + spend,
              metaRevenue: acc.metaRevenue + metaRevenue,
              impressions: acc.impressions + impressions,
              clicks: acc.clicks + clicks,
              purchases: acc.purchases + purchases,
              purchaseRoas: purchaseRoas || acc.purchaseRoas,
              ctr: ctr || acc.ctr,
              addToCart: acc.addToCart + addToCart,
              addToCartOmni: acc.addToCartOmni + addToCartOmni,
              checkoutInitiated: acc.checkoutInitiated + checkoutInitiated,
              checkoutInitiatedOmni: acc.checkoutInitiatedOmni + checkoutInitiatedOmni,
            });
            continue;
          }

          // Accumulate this row into the per-(product, date) map.
          // Regular insights do not add to or overwrite product-breakdown insights.
          const key = `${productMetaId}\x00${insightDate.toISOString()}`;
          const existing = productDateAccum.get(key);
          if (source === 'regular' && existing?.source === 'product') continue;

          if (!existing) {
            productDateAccum.set(key, {
              productMetaId, insightDate,
              spend, metaRevenue, impressions, clicks, purchases, purchaseRoas,
              addToCart, addToCartOmni, checkoutInitiated, checkoutInitiatedOmni,
              source,
            });
          } else {
            productDateAccum.set(key, {
              ...existing,
              spend: existing.spend + spend,
              metaRevenue: existing.metaRevenue + metaRevenue,
              impressions: existing.impressions + impressions,
              clicks: existing.clicks + clicks,
              purchases: existing.purchases + purchases,
              // Keep the last non-zero ROAS value across campaigns
              purchaseRoas: purchaseRoas || existing.purchaseRoas,
              addToCart: existing.addToCart + addToCart,
              addToCartOmni: existing.addToCartOmni + addToCartOmni,
              checkoutInitiated: existing.checkoutInitiated + checkoutInitiated,
              checkoutInitiatedOmni: existing.checkoutInitiatedOmni + checkoutInitiatedOmni,
            });
          }

          if (matchMethod !== "none") {
            matchCounts[matchMethod] = (matchCounts[matchMethod] ?? 0) + 1;
          }
        }
      }

      // --- Step 5b: Upsert summed metrics for every (product, date) ---
      // writtenKeys prevents Step 6 from adding proportional spend on top.
      const writtenKeys = new Set<string>();

      for (const entry of productDateAccum.values()) {
        const {
          productMetaId, insightDate,
          spend, metaRevenue, impressions, clicks, purchases, purchaseRoas,
          addToCart, addToCartOmni, checkoutInitiated, checkoutInitiatedOmni,
        } = entry;

        const existingMetric = await prisma.dailyMetric.findUnique({
          where: { storeId_productId_date: { storeId, productId: productMetaId, date: insightDate } }
        });

        const revenue = existingMetric?.revenue ?? 0;
        // blendedRoas: platform revenue / total Meta spend (both in store currency)
        const blendedRoas = revenue > 0 && spend > 0 ? revenue / spend : purchaseRoas;
        // Recompute CTR and CVR from summed impressions/clicks (more accurate than averaging)
        const ctr = impressions > 0 ? clicks / impressions : 0;
        const conversionRate = clicks > 0 ? purchases / clicks : 0;
        // Aggregate Meta ROAS = total attributed revenue / total spend
        const aggregateRoas = spend > 0 && metaRevenue > 0 ? metaRevenue / spend : purchaseRoas;

        await prisma.dailyMetric.upsert({
          where: { storeId_productId_date: { storeId, productId: productMetaId, date: insightDate } },
          create: {
            date: insightDate,
            roas: aggregateRoas,
            blendedRoas,
            ctr,
            conversionRate,
            margin: existingMetric?.margin ?? 0.35,
            velocity: revenue / 30,
            spend,
            revenue,
            metaRevenue,
            impressions,
            clicks,
            conversions: Math.round(purchases),
            addToCart,
            addToCartOmni,
            checkoutInitiated,
            checkoutInitiatedOmni,
            storeId,
            productId: productMetaId,
          },
          update: {
            roas: aggregateRoas,
            blendedRoas,
            ctr,
            spend,
            metaRevenue,
            impressions,
            clicks,
            conversions: Math.round(purchases),
            conversionRate,
            addToCart,
            addToCartOmni,
            checkoutInitiated,
            checkoutInitiatedOmni,
          },
        });

        writtenKeys.add(`${productMetaId}\x00${insightDate.toISOString()}`);
        totalMatched++;
      }

      // --- Step 6: Proportional distribution of unmatched spend ---
      // For ads we couldn't attribute to a specific product, split spend
      // across products proportionally based on each product's store revenue that day.
      let unmatchedSpendTotal = 0;
      for (const [dateKey, accum] of unmatchedAccum) {
        const insightDate = new Date(dateKey);

        unmatchedSpendTotal += accum.spend;

        const metricsForDay = await prisma.dailyMetric.findMany({
          where: { storeId, date: insightDate },
          select: { productId: true, revenue: true, margin: true }
        });
        const totalRevenue = metricsForDay.reduce((sum, m) => sum + (m.revenue ?? 0), 0);

        if (totalRevenue === 0) continue;

        for (const metric of metricsForDay) {
          const productRevenue = metric.revenue ?? 0;
          if (productRevenue === 0) continue;

          const writeKey = `${metric.productId}\x00${insightDate.toISOString()}`;
          if (writtenKeys.has(writeKey)) continue; // matched insight already wrote this slot

          const share = productRevenue / totalRevenue;
          const pSpend = accum.spend * share;
          const pImpressions = Math.round(accum.impressions * share);
          const pClicks = Math.round(accum.clicks * share);
          const blendedRoas = pSpend > 0 ? productRevenue / pSpend : accum.purchaseRoas;

          await prisma.dailyMetric.upsert({
            where: { storeId_productId_date: { storeId, productId: metric.productId, date: insightDate } },
            create: {
              date: insightDate,
              roas: accum.purchaseRoas,
              blendedRoas,
              ctr: accum.ctr,
              conversionRate: pClicks > 0 ? (accum.purchases * share) / pClicks : 0,
              margin: metric.margin ?? 0.35,
              velocity: productRevenue / 30,
              spend: pSpend,
              revenue: productRevenue,
              metaRevenue: accum.metaRevenue * share,
              impressions: pImpressions,
              clicks: pClicks,
              conversions: Math.round(accum.purchases * share),
              addToCart: 0,
              addToCartOmni: 0,
              checkoutInitiated: 0,
              checkoutInitiatedOmni: 0,
              storeId,
              productId: metric.productId
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
              conversionRate: pClicks > 0 ? (accum.purchases * share) / pClicks : 0,
              addToCart: 0,
              addToCartOmni: 0,
              checkoutInitiated: 0,
              checkoutInitiatedOmni: 0,
            }
          });

          writtenKeys.add(writeKey);
          totalMatched++;
        }
      }

      // Visibility: write a compact summary audit log for this account sync
      try {
        const matchedThisAccount = totalMatched - matchedBefore;
        await prisma.auditLog.create({
          data: {
            action: "Meta Sync — Summary",
            detail: `Matched ${matchedThisAccount} insight rows for account ${account.account_id}. Unmatched spend: ${unmatchedSpendTotal.toFixed(2)} (${storeCurrency}).`,
            metadata: {
              matched: matchedThisAccount,
              unmatchedSpend: unmatchedSpendTotal,
              currency: storeCurrency,
              matchCounts,
              productBreakdownSucceeded,
              adAccounts: adAccounts.length,
              accountId: account.account_id,
              accountGraphId: account.id,
              tag: "Info",
              variant: "info"
            },
            storeId
          }
        });
      } catch {
        // non-fatal
      }
    } catch (err) {
      // Don't fail the whole sync if one ad account errors
      console.error(`Meta sync error for account ${account.account_id}:`, err);
    }
  }

  // --- Post-sync: log unmatched catalog products ---
  // If any Meta catalog items could not be matched to a WooCommerce/Shopify product
  // after all matching strategies (retailer_id, SKU from title, title similarity),
  // write a single audit log entry so the merchant can clean up their Meta catalog
  // or fix the SKU field on the unmatched WooCommerce products.
  if (unmatchedCatalogItems.size > 0) {
    const items = [...unmatchedCatalogItems.entries()].map(([retailerId, { name, catalogItemId }]) => ({
      retailerId,
      name,
      catalogItemId
    }));

    // Log up to 50 unmatched items to keep the audit entry readable.
    // If there are more, the detail line mentions the total count.
    const sample = items.slice(0, 50);
    const detail =
      `${items.length} Meta catalog product${items.length === 1 ? "" : "s"} could not be matched ` +
      `to any store product. Check that the SKU in Meta's catalog matches the SKU in WooCommerce/Shopify. ` +
      (items.length > 50 ? `Showing first 50 of ${items.length}. ` : "") +
      `Products: ${sample.map(i => `"${i.name}" (retailer_id: ${i.retailerId})`).join("; ")}`;

    try {
      await prisma.auditLog.create({
        data: {
          action: "Meta Sync — Unmatched Catalog Products",
          detail,
          metadata: {
            unmatchedCount: items.length,
            items: sample,
            tag: "Warning",
            variant: "warning"
          },
          storeId
        }
      });
      console.log(`[syncMeta] ${items.length} unmatched catalog item(s) logged to audit log`);
    } catch (err) {
      console.warn("[syncMeta] Failed to write unmatched catalog audit log:", err);
    }
  }

  return { adAccounts: adAccounts.length, insightsMatched: totalMatched, unmatchedCatalogItems: unmatchedCatalogItems.size };
}
