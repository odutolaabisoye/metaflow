import type { PrismaClient } from "@prisma/client";
import { storeLocalDayBounds, storeLocalDateStr } from "./dateUtils.js";

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
  line_items: Array<{
    product_id: number;
    variant_id: number;
    quantity: number;
    price: string;
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

  const res = await fetch(url, {
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
  const { storeId, shop, accessToken, timezone = "Africa/Lagos" } = data;

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
  // This lets us write one correct DailyMetric row per day per product and
  // naturally backfill the last 30 days on every sync run.
  const revenueMapByDate = new Map<number, Map<string, { revenue: number; orderCount: number }>>();
  const todayLocalStr = storeLocalDateStr(timezone); // e.g. "2026-03-20"

  for (const order of orders) {
    const orderLocalDate = storeLocalDateStr(timezone, new Date(order.created_at));
    for (const item of order.line_items) {
      const itemId = item.variant_id && item.variant_id > 0 ? item.variant_id : item.product_id;
      const itemRevenue = parseFloat(item.price) * item.quantity;
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
          isVariant: true,
          parentId: parent.id
        },
        update: {
          title: variantTitle,
          imageUrl,
          sku: variantSku,
          productUrl: variantUrl,
          inventoryLevel: variant.inventory_quantity ?? null,
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

  return { products: products.length, orders: orders.length };
}
