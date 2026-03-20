import type { PrismaClient } from "@prisma/client";
import { storeLocalDayBounds, storeLocalDateStr } from "./dateUtils.js";

const WC_API_VERSION = "wc/v3";

interface WCProduct {
  id: number;
  name: string;
  sku: string;
  permalink: string;
  images: Array<{ src: string }>;
  stock_quantity: number | null;
  status: string;
  /** "simple" | "variable" | "grouped" | "external" */
  type: string;
}

interface WCVariation {
  id: number;
  stock_quantity: number | null;
}

interface WCOrder {
  id: number;
  date_created: string;
  status: string;
  line_items: Array<{
    product_id: number;
    quantity: number;
    total: string;
  }>;
}

async function wcFetch<T>(
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string,
  path: string,
  page = 1
): Promise<{ data: T; totalPages: number }> {
  const base = storeUrl.replace(/\/$/, "");
  const url = `${base}/wp-json/${WC_API_VERSION}${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`;

  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

  const res = await fetch(url, {
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json"
    }
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WooCommerce API error ${res.status}: ${body}`);
  }

  const totalPages = parseInt(res.headers.get("X-WP-TotalPages") ?? "1", 10);

  return { data: await res.json() as T, totalPages };
}

async function wcPaginate<T>(
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string,
  path: string
): Promise<T[]> {
  const items: T[] = [];

  const { data: firstPage, totalPages } = await wcFetch<T[]>(
    storeUrl, consumerKey, consumerSecret, path, 1
  );
  items.push(...firstPage);

  for (let page = 2; page <= totalPages; page++) {
    const { data } = await wcFetch<T[]>(storeUrl, consumerKey, consumerSecret, path, page);
    items.push(...data);
  }

  return items;
}

interface SyncWooCommerceData {
  storeId: string;
  storeUrl: string;
  /** Stored as "consumerKey:consumerSecret" in accessToken field */
  accessToken: string;
  /** IANA timezone string for this store, e.g. "America/New_York". Defaults to "Africa/Lagos". */
  timezone?: string;
}

/**
 * runWooCommerceSync
 *
 * 1. Parses consumer key + secret from the accessToken field
 * 2. Fetches all published products from WooCommerce
 * 3. For variable products, fetches ALL variation IDs (in-stock + out-of-stock)
 *    and stores them in the product's `altIds` field.
 *    Meta catalogs report spend at the variation level — syncMeta uses altIds
 *    to map any variation ID back to the parent product for correct attribution.
 * 4. Fetches orders from last 30 days
 * 5. Aggregates revenue by parent product_id (not variation_id)
 * 6. Upserts ProductMeta + DailyMetric for each parent product
 */
export async function runWooCommerceSync(
  prisma: PrismaClient,
  data: SyncWooCommerceData
): Promise<{ products: number; orders: number }> {
  const { storeId, storeUrl, accessToken, timezone = "Africa/Lagos" } = data;

  // accessToken is stored as "key:secret"
  const [consumerKey, consumerSecret] = accessToken.split(":");
  if (!consumerKey || !consumerSecret) {
    throw new Error("Invalid WooCommerce credentials format — expected 'key:secret'");
  }

  // --- Step 1: Fetch all published products ---
  const products = await wcPaginate<WCProduct>(
    storeUrl, consumerKey, consumerSecret, "/products?status=publish"
  );

  // --- Step 2: Fetch recent orders ---
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const afterIso = since.toISOString();

  const orders = await wcPaginate<WCOrder>(
    storeUrl, consumerKey, consumerSecret,
    `/orders?status=completed,processing&after=${afterIso}`
  );

  // --- Step 3: Aggregate revenue per PARENT product, per day ---
  //
  // revenueMapByDate: productId → (localDateStr → {revenue, orderCount})
  //
  // We store revenue broken down by the store-local date of each order.
  // This lets us write ONE correct DailyMetric row per day per product —
  // rather than a single "today" row containing the entire 30-day cumulative.
  //
  // Root-cause recap: the old approach wrote revenueMap30d.get(pid).revenue
  // (a 30-day total) into today's DailyMetric.revenue on every sync run.
  // That made every row look like a ₦23-30M day when the real monthly max was ₦60M.
  const revenueMapByDate = new Map<number, Map<string, { revenue: number; orderCount: number }>>();
  const todayLocalStr = storeLocalDateStr(timezone); // e.g. "2026-03-20"

  for (const order of orders) {
    const orderLocalDate = storeLocalDateStr(timezone, new Date(order.date_created));
    for (const item of order.line_items) {
      const pid = item.product_id;
      const rev = parseFloat(item.total);
      if (!revenueMapByDate.has(pid)) revenueMapByDate.set(pid, new Map());
      const dateMap = revenueMapByDate.get(pid)!;
      const existing = dateMap.get(orderLocalDate) ?? { revenue: 0, orderCount: 0 };
      dateMap.set(orderLocalDate, { revenue: existing.revenue + rev, orderCount: existing.orderCount + 1 });
    }
  }

  // Use the store's local timezone to determine "today" — not the server OS clock.
  const today = storeLocalDayBounds(timezone).start;

  // --- Step 4: Upsert parent products + daily metrics ---
  //
  // For each product we write:
  //   • One full DailyMetric row for TODAY  (revenue + velocity + inventory)
  //   • One revenue-only update for each HISTORICAL date that has orders
  //
  // Historical rows only update `revenue` and `conversions` so we never
  // overwrite Meta spend/ROAS data that syncMeta already wrote for those dates.
  for (const product of products) {
    const externalId = String(product.id);
    const imageUrl = product.images[0]?.src ?? null;
    const sku = product.sku || `WC-${product.id}`;
    const productUrl = product.permalink || null;

    // Sum all days' revenue for this product → 30-day total → velocity
    const dateMap = revenueMapByDate.get(product.id);
    const revenue30d = dateMap
      ? [...dateMap.values()].reduce((sum, e) => sum + e.revenue, 0)
      : 0;
    const velocity = revenue30d / 30; // avg daily revenue over last 30 days

    const todayEntry  = dateMap?.get(todayLocalStr) ?? { revenue: 0, orderCount: 0 };
    const productRevenue = todayEntry.revenue;
    const productOrders  = todayEntry.orderCount;

    // For variable products, collect ALL variation IDs (in-stock and out-of-stock).
    // Also sum variation stock quantities — parent stock_quantity is null for variable products.
    let altIds: string[] = [];
    let inventoryLevel: number | null = product.stock_quantity;
    if (product.type === "variable") {
      try {
        const variations = await wcPaginate<WCVariation>(
          storeUrl, consumerKey, consumerSecret,
          `/products/${product.id}/variations?status=any`
        );
        altIds = variations.map((v) => String(v.id));
        inventoryLevel = variations.reduce((sum, v) => sum + (v.stock_quantity ?? 0), 0);
      } catch {
        // Non-fatal: keep parent stock_quantity as fallback
      }
    }

    // Upsert the parent product (never overwrite score/category)
    const upserted = await prisma.productMeta.upsert({
      where: { storeId_externalId: { storeId, externalId } },
      create: {
        externalId,
        sku,
        altIds,
        title: product.name,
        imageUrl,
        productUrl,
        score: 0,
        category: "TEST",
        storeId
      },
      update: {
        title: product.name,
        imageUrl,
        sku,
        altIds,
        productUrl,
        ...(inventoryLevel !== null ? { inventoryLevel } : {})
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
        conversionRate: 0,
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
        ...(inventoryLevel !== null ? { inventoryLevel } : {})
      }
    });

    // --- Historical rows: revenue-only upsert (preserve Meta spend/ROAS) ---
    if (dateMap) {
      for (const [localDateStr, entry] of dateMap) {
        if (localDateStr === todayLocalStr) continue; // already written above

        // Convert the local date string back to the store's midnight in UTC
        // by using noon of that day as a DST-safe probe.
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
          // Only overwrite revenue + conversions — never touch spend/ROAS/Meta fields
          // that syncMeta has already written for this historical date.
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
