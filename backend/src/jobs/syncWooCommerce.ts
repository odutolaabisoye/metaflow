import type { PrismaClient } from "@prisma/client";

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
  const { storeId, storeUrl, accessToken } = data;

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

  // --- Step 3: Aggregate revenue per PARENT product ---
  // Always key by product_id (the parent), not variation_id.
  // This keeps revenue attributed to the single ProductMeta record per product.
  const revenueMap = new Map<number, { revenue: number; orderCount: number }>();

  for (const order of orders) {
    for (const item of order.line_items) {
      const pid = item.product_id;
      const rev = parseFloat(item.total);
      const existing = revenueMap.get(pid) ?? { revenue: 0, orderCount: 0 };
      revenueMap.set(pid, {
        revenue: existing.revenue + rev,
        orderCount: existing.orderCount + 1
      });
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // --- Step 4: Upsert parent products + daily metrics ---
  for (const product of products) {
    const externalId = String(product.id);
    const imageUrl = product.images[0]?.src ?? null;
    const sku = product.sku || `WC-${product.id}`;
    const productUrl = product.permalink || null;
    const inventoryLevel = product.stock_quantity;

    const productRevenue = revenueMap.get(product.id)?.revenue ?? 0;
    const productOrders = revenueMap.get(product.id)?.orderCount ?? 0;
    const velocity = productRevenue / 30;

    // For variable products, collect ALL variation IDs (in-stock and out-of-stock).
    // These go into `altIds` so that when Meta reports spend for variation 34523,
    // syncMeta can find this parent product (34520) via the altIds lookup map.
    let altIds: string[] = [];
    if (product.type === "variable") {
      try {
        const variations = await wcPaginate<WCVariation>(
          storeUrl, consumerKey, consumerSecret,
          `/products/${product.id}/variations?status=any`
        );
        altIds = variations.map((v) => String(v.id));
      } catch {
        // Non-fatal: if variations can't be fetched, syncMeta falls back to
        // matching by parent externalId or SKU
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
        productUrl
      }
    });

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
  }

  return { products: products.length, orders: orders.length };
}
