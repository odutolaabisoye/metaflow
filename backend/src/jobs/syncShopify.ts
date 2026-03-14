import type { PrismaClient } from "@prisma/client";

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
  const { storeId, shop, accessToken } = data;

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

  // --- Step 3: Aggregate revenue per product ID ---
  const revenueMap = new Map<number, { revenue: number; orderCount: number }>();

  for (const order of orders) {
    for (const item of order.line_items) {
      const productId = item.variant_id && item.variant_id > 0 ? item.variant_id : item.product_id;
      const itemRevenue = parseFloat(item.price) * item.quantity;

      const existing = revenueMap.get(productId) ?? { revenue: 0, orderCount: 0 };
      revenueMap.set(productId, {
        revenue: existing.revenue + itemRevenue,
        orderCount: existing.orderCount + 1
      });
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // --- Step 4: Upsert products and daily metrics ---
  for (const product of products) {
    const firstVariant = product.variants[0];
    if (!firstVariant) continue;

    const externalId = String(product.id);
    const imageUrl = product.images[0]?.src ?? null;
    const sku = firstVariant.sku || `SHOPIFY-${firstVariant.id}`;
    const productUrl = product.handle ? `https://${shop}/products/${product.handle}` : null;
    // All variant IDs for this product — Meta catalogs report at variant level.
    // Storing these lets syncMeta match "variant_id" insights back to this product.
    const altIds = product.variants.map((v) => String(v.id));
    const variantRecords = product.variants.map((v) => {
      const options = [v.option1, v.option2, v.option3].filter(Boolean).join(" / ");
      const title = options ? `${product.title} — ${options}` : (v.title || product.title);
      return {
        id: v.id,
        sku: v.sku || `SHOPIFY-VAR-${v.id}`,
        title,
        inventoryLevel: v.inventory_quantity ?? 0
      };
    });
    const inventoryLevel = product.variants.reduce(
      (sum, v) => sum + (v.inventory_quantity ?? 0),
      0
    );

    const productRevenue = revenueMap.get(product.id)?.revenue ?? 0;
    const productOrders = revenueMap.get(product.id)?.orderCount ?? 0;

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
        isVariant: false,
        storeId
      },
      update: {
        title: product.title,
        imageUrl,
        sku,
        altIds,
        productUrl
      }
    });

    // Compute a basic velocity: avg daily revenue over 30 days
    const velocity = productRevenue / 30;

    // Use placeholder ad metrics (0 until Meta sync fills them)
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
        margin: 0.35, // Default 35% margin until actual COGS data is available
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

    // --- Step 4b: Upsert variant products ---
    for (const v of variantRecords) {
      const vExternalId = String(v.id);
      const vRevenue = revenueMap.get(v.id)?.revenue ?? 0;
      const vOrders = revenueMap.get(v.id)?.orderCount ?? 0;
      const vVelocity = vRevenue / 30;

      const vProduct = await prisma.productMeta.upsert({
        where: { storeId_externalId: { storeId, externalId: vExternalId } },
        create: {
          externalId: vExternalId,
          sku: v.sku,
          altIds: [],
          title: v.title,
          imageUrl,
          productUrl,
          score: 0,
          category: "TEST",
          isVariant: true,
          parentId: upserted.id,
          storeId
        },
        update: {
          sku: v.sku,
          title: v.title,
          imageUrl,
          productUrl,
          isVariant: true,
          parentId: upserted.id
        }
      });

      const existingVMetric = await prisma.dailyMetric.findUnique({
        where: { storeId_productId_date: { storeId, productId: vProduct.id, date: today } }
      });

      await prisma.dailyMetric.upsert({
        where: { storeId_productId_date: { storeId, productId: vProduct.id, date: today } },
        create: {
          date: today,
          roas: existingVMetric?.roas ?? 0,
          blendedRoas: existingVMetric?.blendedRoas ?? null,
          ctr: existingVMetric?.ctr ?? 0,
          conversionRate: vOrders > 0 ? vOrders / Math.max(1, vOrders * 40) : 0,
          margin: 0.35,
          velocity: vVelocity,
          spend: existingVMetric?.spend ?? 0,
          revenue: vRevenue,
          metaRevenue: existingVMetric?.metaRevenue ?? null,
          impressions: existingVMetric?.impressions ?? null,
          clicks: existingVMetric?.clicks ?? null,
          conversions: vOrders,
          inventoryLevel: v.inventoryLevel ?? null,
          storeId,
          productId: vProduct.id
        },
        update: {
          revenue: vRevenue,
          conversions: vOrders,
          velocity: vVelocity,
          ...(v.inventoryLevel !== null ? { inventoryLevel: v.inventoryLevel } : {})
        }
      });
    }
  }

  return { products: products.length, orders: orders.length };
}
