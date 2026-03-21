import type { PrismaClient } from "@prisma/client";
import { storeLocalDayBounds, storeLocalDateStr } from "./dateUtils.js";
import { getExchangeRate } from "../utils/fx.js";
import { fetchWithRetry } from "../utils/http.js";

const SHOPIFY_API_VERSION = "2024-04";

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  variants: Array<{
    id: number;
    sku: string;
    title?: string;
    option1?: string | null;
    option2?: string | null;
    option3?: string | null;
    inventory_quantity: number;
    price: string;
  }>;
  images: Array<{ src: string }>;
}

interface ShopifyOrder {
  id: number;
  created_at: string;
  currency: string;        // order's presentment currency code, e.g. "USD"
  line_items: Array<{
    product_id: number;
    variant_id: number;
    quantity: number;
    price: string;
    /** Total discount applied to this line item (e.g. "5.00"). Included in the
     *  Shopify Orders REST response.  Must be subtracted so revenue reflects
     *  what the merchant actually received, not the pre-discount list price. */
    total_discount: string;
  }>;
  financial_status: string;
}

async function shopifyFetch<T>(
  shop: string,
  accessToken: string,
  path: string,
  pageInfo?: string
): Promise<{ data: T; nextPageInfo?: string }> {
  const url = pageInfo
    ? `https://${shop}/admin/api/${SHOPIFY_API_VERSION}${path}&page_info=${pageInfo}&limit=250`
    : `https://${shop}/admin/api/${SHOPIFY_API_VERSION}${path}${path.includes("?") ? "&" : "?"}limit=250`;

  const res = await fetchWithRetry(url, {
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json"
    }
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shopify API error ${res.status}: ${body}`);
  }

  // Extract next page cursor from Link header
  const linkHeader = res.headers.get("Link") ?? "";
  const nextMatch = linkHeader.match(/<[^>]+page_info=([^>&]+)[^>]*>;\s*rel="next"/);
  const nextPageInfo = nextMatch?.[1];

  return { data: await res.json() as T, nextPageInfo };
}

/**
 * Paginate through a Shopify endpoint using cursor-based pagination.
 */
async function shopifyPaginate<T, I>(
  shop: string,
  accessToken: string,
  path: string,
  key: string
): Promise<I[]> {
  const items: I[] = [];
  let pageInfo: string | undefined;

  do {
    const { data, nextPageInfo } = await shopifyFetch<T>(shop, accessToken, path, pageInfo);
    const page = (data as Record<string, unknown>)[key] as I[];
    items.push(...page);
    pageInfo = nextPageInfo;
  } while (pageInfo);

  return items;
}

interface SyncShopifyData {
  storeId: string;
  shop: string;          // e.g. "mystore.myshopify.com"
  accessToken: string;
  /** IANA timezone string for this store, e.g. "America/New_York". Defaults to "Africa/Lagos". */
  timezone?: string;
  /** Store's base currency code, e.g. "NGN". Used for multi-currency FX conversion. */
  storeCurrency?: string;
}

/**
 * runShopifySync
 *
 * 1. Fetches all products from Shopify (paginated)
 * 2. Fetches all orders from last 30 days
 * 3. Computes per-product revenue, order count, velocity
 * 4. Upserts ProductMeta + DailyMetric for today
 */
export async function runShopifySync(
  prisma: PrismaClient,
  data: SyncShopifyData
): Promise<{ products: number; orders: number }> {
  const { storeId, shop, accessToken, timezone = "Africa/Lagos", storeCurrency } = data;

  // --- Step 1: Fetch all products ---
  const products = await shopifyPaginate<{ products: ShopifyProduct[] }, ShopifyProduct>(
    shop,
    accessToken,
    "/products.json",
    "products"
  );

  // --- Step 2: Fetch orders from last 30 days ---
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceIso = since.toISOString();

  const orders = await shopifyPaginate<{ orders: ShopifyOrder[] }, ShopifyOrder>(
    shop,
    accessToken,
    `/orders.json?status=any&created_at_min=${sinceIso}&financial_status=paid`,
    "orders"
  );

  // --- Step 3: Aggregate revenue per ITEM ID (variant_id preferred), per day ---
  //
  // revenueMapByDate: productId → (localDateStr → {revenue, orderCount})
  //
  // Multi-currency: Shopify can send orders in different currencies when a store
  // uses Shopify Markets. We build a per-currency FX rate cache for the batch so
  // we only call the FX API once per unique currency, not once per order.
  //
  // For most stores all orders share the same currency → fxRateCache has 1 entry
  // and no network call is made (same currency → rate 1.0).
  const revenueMapByDate = new Map<number, Map<string, { revenue: number; orderCount: number }>>();
  const todayLocalStr = storeLocalDateStr(timezone); // e.g. "2026-03-20"
  const fxRateCache = new Map<string, number>(); // orderCurrency → rate to storeCurrency

  async function getFxRate(orderCurrency: string): Promise<number> {
    if (!storeCurrency || orderCurrency === storeCurrency) return 1;
    const cached = fxRateCache.get(orderCurrency);
    if (cached !== undefined) return cached;
    const rate = await getExchangeRate(orderCurrency, storeCurrency);
    fxRateCache.set(orderCurrency, rate);
    if (rate !== 1) {
      console.log(`[syncShopify] FX ${orderCurrency}→${storeCurrency}: ${rate.toFixed(6)}`);
    }
    return rate;
  }

  for (const order of orders) {
    const orderLocalDate = storeLocalDateStr(timezone, new Date(order.created_at));
    const fxRate = await getFxRate(order.currency ?? storeCurrency ?? "");
    for (const item of order.line_items) {
      const itemId = item.variant_id && item.variant_id > 0 ? item.variant_id : item.product_id;
      // Use gross revenue minus line-item discount so we track what the merchant
      // actually received, not the pre-discount list price.
      const grossRevenue = parseFloat(item.price) * item.quantity;
      const lineDiscount = parseFloat(item.total_discount ?? "0") || 0;
      const itemRevenue = (grossRevenue - lineDiscount) * fxRate;
      if (!revenueMapByDate.has(itemId)) revenueMapByDate.set(itemId, new Map());
      const dateMap = revenueMapByDate.get(itemId)!;
      const existing = dateMap.get(orderLocalDate) ?? { revenue: 0, orderCount: 0 };
      dateMap.set(orderLocalDate, { revenue: existing.revenue + itemRevenue, orderCount: existing.orderCount + 1 });
    }
  }

  // Use the store's local timezone to determine "today" — not the server OS clock.
  const today = storeLocalDayBounds(timezone).start;

  function buildVariantTitle(productTitle: string, variantTitle?: string) {
    if (!variantTitle || variantTitle.toLowerCase() === "default title") return productTitle;
    return `${productTitle} — ${variantTitle}`;
  }

  // --- Step 4: Upsert products and daily metrics ---
  //
  // For each product we write:
  //   • One full DailyMetric row for TODAY  (revenue + velocity + inventory)
  //   • One revenue-only update for each HISTORICAL date that has orders
  //     (preserves Meta spend/ROAS data syncMeta already wrote for those dates)
  for (const product of products) {
    const firstVariant = product.variants[0];
    if (!firstVariant) continue;

    const parentExternalId = String(product.id);
    const imageUrl = product.images[0]?.src ?? null;
    const parentSku = firstVariant.sku || `SHOPIFY-${firstVariant.id}`;
    const productUrl = product.handle ? `https://${shop}/products/${product.handle}` : null;
    const altIds = product.variants.map((v) => String(v.id));
    const inventoryLevel = product.variants.reduce(
      (sum, v) => sum + (v.inventory_quantity ?? 0),
      0
    );

    // Upsert parent ProductMeta
    const parent = await prisma.productMeta.upsert({
      where: { storeId_externalId: { storeId, externalId: parentExternalId } },
      create: {
        externalId: parentExternalId,
        sku: parentSku,
        altIds,
        title: product.title,
        imageUrl,
        productUrl,
        score: 0,
        category: "TEST",
        storeId,
        isActive: true,
        archivedAt: null,
        isVariant: false,
        parentId: null
      },
      update: {
        title: product.title,
        imageUrl,
        sku: parentSku,
        altIds,
        productUrl,
        inventoryLevel,
        isActive: true,
        archivedAt: null,
        isVariant: false,
        parentId: null
      }
    });

    // Upsert each variant as its own ProductMeta + DailyMetric rows
    for (const variant of product.variants) {
      const variantExternalId = String(variant.id);
      const variantSku = variant.sku || `SHOPIFY-${variant.id}`;
      const variantTitle = buildVariantTitle(product.title, variant.title);
      const variantUrl = productUrl ? `${productUrl}?variant=${variant.id}` : null;

      const variantMeta = await prisma.productMeta.upsert({
        where: { storeId_externalId: { storeId, externalId: variantExternalId } },
        create: {
          externalId: variantExternalId,
          sku: variantSku,
          title: variantTitle,
          imageUrl,
          productUrl: variantUrl,
          score: 0,
          category: "TEST",
          storeId,
          isActive: true,
          archivedAt: null,
          isVariant: true,
          parentId: parent.id
        },
        update: {
          title: variantTitle,
          imageUrl,
          sku: variantSku,
          productUrl: variantUrl,
          inventoryLevel: variant.inventory_quantity ?? null,
          isActive: true,
          archivedAt: null,
          isVariant: true,
          parentId: parent.id
        }
      });

      const dateMap = revenueMapByDate.get(variant.id);
      const revenue30d = dateMap
        ? [...dateMap.values()].reduce((sum, e) => sum + e.revenue, 0)
        : 0;
      const velocity = revenue30d / 30;

      const todayEntry     = dateMap?.get(todayLocalStr) ?? { revenue: 0, orderCount: 0 };
      const variantRevenue = todayEntry.revenue;
      const variantOrders  = todayEntry.orderCount;

      const existingMetric = await prisma.dailyMetric.findUnique({
        where: { storeId_productId_date: { storeId, productId: variantMeta.id, date: today } }
      });

      await prisma.dailyMetric.upsert({
        where: { storeId_productId_date: { storeId, productId: variantMeta.id, date: today } },
        create: {
          date: today,
          roas: existingMetric?.roas ?? 0,
          blendedRoas: existingMetric?.blendedRoas ?? null,
          ctr: existingMetric?.ctr ?? 0,
          conversionRate: variantOrders > 0 ? variantOrders / Math.max(1, variantOrders * 40) : 0,
          margin: 0.35,
          velocity,
          spend: existingMetric?.spend ?? 0,
          revenue: variantRevenue,
          metaRevenue: existingMetric?.metaRevenue ?? null,
          impressions: existingMetric?.impressions ?? null,
          clicks: existingMetric?.clicks ?? null,
          conversions: variantOrders,
          inventoryLevel: variant.inventory_quantity ?? null,
          storeId,
          productId: variantMeta.id
        },
        update: {
          revenue: variantRevenue,
          conversions: variantOrders,
          velocity,
          inventoryLevel: variant.inventory_quantity ?? null
        }
      });

      if (dateMap) {
        for (const [localDateStr, entry] of dateMap) {
          if (localDateStr === todayLocalStr) continue;

          const historicalDate = storeLocalDayBounds(
            timezone,
            new Date(`${localDateStr}T12:00:00Z`)
          ).start;

          await prisma.dailyMetric.upsert({
            where: { storeId_productId_date: { storeId, productId: variantMeta.id, date: historicalDate } },
            create: {
              date: historicalDate,
              roas: 0,
              blendedRoas: null,
              ctr: 0,
              conversionRate: 0,
              margin: 0.35,
              velocity,
              spend: 0,
              revenue: entry.revenue,
              metaRevenue: null,
              impressions: null,
              clicks: null,
              conversions: entry.orderCount,
              inventoryLevel: null,
              storeId,
              productId: variantMeta.id
            },
            update: {
              revenue: entry.revenue,
              conversions: entry.orderCount,
            }
          });
        }
      }
    }

    // Optional: write parent daily metrics only when orders come in without variant_id
    const parentDateMap = revenueMapByDate.get(product.id);
    if (parentDateMap) {
      const revenue30d = [...parentDateMap.values()].reduce((sum, e) => sum + e.revenue, 0);
      const velocity = revenue30d / 30;
      const todayEntry = parentDateMap.get(todayLocalStr) ?? { revenue: 0, orderCount: 0 };
      const existingMetric = await prisma.dailyMetric.findUnique({
        where: { storeId_productId_date: { storeId, productId: parent.id, date: today } }
      });
      await prisma.dailyMetric.upsert({
        where: { storeId_productId_date: { storeId, productId: parent.id, date: today } },
        create: {
          date: today,
          roas: existingMetric?.roas ?? 0,
          blendedRoas: existingMetric?.blendedRoas ?? null,
          ctr: existingMetric?.ctr ?? 0,
          conversionRate: 0,
          margin: 0.35,
          velocity,
          spend: existingMetric?.spend ?? 0,
          revenue: todayEntry.revenue,
          metaRevenue: existingMetric?.metaRevenue ?? null,
          impressions: existingMetric?.impressions ?? null,
          clicks: existingMetric?.clicks ?? null,
          conversions: todayEntry.orderCount,
          inventoryLevel,
          storeId,
          productId: parent.id
        },
        update: {
          revenue: todayEntry.revenue,
          conversions: todayEntry.orderCount,
          velocity,
          inventoryLevel
        }
      });
    }
  }

  // Mark products no longer present in Shopify as inactive
  const seenExternalIds = new Set<string>();
  for (const product of products) {
    seenExternalIds.add(String(product.id));
    for (const v of product.variants) {
      seenExternalIds.add(String(v.id));
    }
  }
  const seenList = [...seenExternalIds];
  if (seenList.length > 0) {
    await prisma.productMeta.updateMany({
      where: {
        storeId,
        isActive: true,
        externalId: { notIn: seenList }
      },
      data: { isActive: false, archivedAt: new Date() }
    });
  }

  return { products: products.length, orders: orders.length };
}
