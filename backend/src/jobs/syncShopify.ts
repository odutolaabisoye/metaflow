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

  // --- Step 3: Aggregate revenue per product ID, per day ---
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
      const productId = item.product_id;
      const itemRevenue = parseFloat(item.price) * item.quantity;
      if (!revenueMapByDate.has(productId)) revenueMapByDate.set(productId, new Map());
      const dateMap = revenueMapByDate.get(productId)!;
      const existing = dateMap.get(orderLocalDate) ?? { revenue: 0, orderCount: 0 };
      dateMap.set(orderLocalDate, { revenue: existing.revenue + itemRevenue, orderCount: existing.orderCount + 1 });
    }
  }

  // Use the store's local timezone to determine "today" — not the server OS clock.
  const today = storeLocalDayBounds(timezone).start;

  // --- Step 4: Upsert products and daily metrics ---
  //
  // For each product we write:
  //   • One full DailyMetric row for TODAY  (revenue + velocity + inventory)
  //   • One revenue-only update for each HISTORICAL date that has orders
  //     (preserves Meta spend/ROAS data syncMeta already wrote for those dates)
  for (const product of products) {
    const firstVariant = product.variants[0];
    if (!firstVariant) continue;

    const externalId = String(product.id);
    const imageUrl = product.images[0]?.src ?? null;
    const sku = firstVariant.sku || `SHOPIFY-${firstVariant.id}`;
    const productUrl = product.handle ? `https://${shop}/products/${product.handle}` : null;
    const altIds = product.variants.map((v) => String(v.id));
    const inventoryLevel = product.variants.reduce(
      (sum, v) => sum + (v.inventory_quantity ?? 0),
      0
    );

    const dateMap = revenueMapByDate.get(product.id);
    const revenue30d = dateMap
      ? [...dateMap.values()].reduce((sum, e) => sum + e.revenue, 0)
      : 0;
    const velocity = revenue30d / 30;

    const todayEntry    = dateMap?.get(todayLocalStr) ?? { revenue: 0, orderCount: 0 };
    const productRevenue = todayEntry.revenue;
    const productOrders  = todayEntry.orderCount;

    // Upsert ProductMeta (never overwrite score/category — that's the scoring engine's job)
    const upserted = await prisma.productMeta.upsert({
      where: { storeId_externalId: { storeId, externalId } },
      create: {
        externalId,
        sku,
        altIds,
        title: product.title,
        imageUrl,
        productUrl,
        score: 0,
        category: "TEST",
        storeId
      },
      update: {
        title: product.title,
        imageUrl,
        sku,
        altIds,
        productUrl,
        inventoryLevel
      }
    });

    // --- Today's row: full upsert (revenue + velocity + inventory) ---
    const existingMetric = await prisma.dailyMetric.findUnique({
      where: { storeId_productId_date: { storeId, productId: upserted.id, date: today } }
    });

    await prisma.dailyMetric.upsert({
      where: { storeId_productId_date: { storeId, productId: upserted.id, date: today } },
      create: {
        date: today,
        roas: existingMetric?.roas ?? 0,
        blendedRoas: existingMetric?.blendedRoas ?? null,
        ctr: existingMetric?.ctr ?? 0,
        conversionRate: productOrders > 0 ? productOrders / Math.max(1, productOrders * 40) : 0,
        margin: 0.35,
        velocity,
        spend: existingMetric?.spend ?? 0,
        revenue: productRevenue,
        metaRevenue: existingMetric?.metaRevenue ?? null,
        impressions: existingMetric?.impressions ?? null,
        clicks: existingMetric?.clicks ?? null,
        conversions: productOrders,
        inventoryLevel,
        storeId,
        productId: upserted.id
      },
      update: {
        revenue: productRevenue,
        conversions: productOrders,
        velocity,
        inventoryLevel
      }
    });

    // --- Historical rows: revenue-only upsert (preserve Meta spend/ROAS) ---
    if (dateMap) {
      for (const [localDateStr, entry] of dateMap) {
        if (localDateStr === todayLocalStr) continue; // already written above

        const historicalDate = storeLocalDayBounds(
          timezone,
          new Date(`${localDateStr}T12:00:00Z`)
        ).start;

        await prisma.dailyMetric.upsert({
          where: { storeId_productId_date: { storeId, productId: upserted.id, date: historicalDate } },
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
            productId: upserted.id
          },
          update: {
            revenue: entry.revenue,
            conversions: entry.orderCount,
          }
        });
      }
    }
  }

  return { products: products.length, orders: orders.length };
}
