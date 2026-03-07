import type { PrismaClient } from "@prisma/client";

const META_GRAPH_VERSION = "v19.0";
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

interface MetaInsight {
  product_id?: string;
  impressions: string;
  clicks: string;
  spend: string;
  actions?: Array<{ action_type: string; value: string }>;
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
 * runMetaSync
 *
 * Pulls ad insights from the Meta Marketing API and merges them with
 * daily metric records already created by the platform sync (Shopify/WooCommerce).
 *
 * Flow:
 *  1. Fetch user's ad accounts
 *  2. For each ad account, fetch campaign-level insights for last 30 days
 *  3. Fetch ad sets to find catalog-linked ads (product_item_id)
 *  4. Match Meta product IDs to ProductMeta via externalId
 *  5. Upsert DailyMetric with Meta-specific fields: spend, roas, impressions, clicks, CTR
 *  6. Compute blendedRoas = (total revenue) / (meta spend)
 */
export async function runMetaSync(
  prisma: PrismaClient,
  data: { storeId: string; accessToken: string }
): Promise<{ adAccounts: number; insightsMatched: number }> {
  const { storeId, accessToken } = data;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const dateRange = JSON.stringify({
    since: since.toISOString().slice(0, 10),
    until: today.toISOString().slice(0, 10)
  });

  // --- Step 1: Get connected ad accounts ---
  const accountsRes = await graphFetch<{ data: MetaAdAccount[] }>(
    "/me/adaccounts",
    accessToken,
    { fields: "account_id,name", limit: "50" }
  );

  const adAccounts = accountsRes.data ?? [];
  if (adAccounts.length === 0) {
    return { adAccounts: 0, insightsMatched: 0 };
  }

  let totalMatched = 0;

  for (const account of adAccounts) {
    try {
      // --- Step 2: Fetch insights aggregated by ad (which links to product) ---
      const insightsRes = await graphFetch<{ data: MetaInsight[] }>(
        `/${account.id}/insights`,
        accessToken,
        {
          level: "ad",
          date_preset: "last_30d",
          time_range: dateRange,
          fields: [
            "impressions",
            "clicks",
            "spend",
            "ctr",
            "purchase_roas",
            "actions",
            "adset_id",
            "ad_id"
          ].join(","),
          limit: "500"
        }
      );

      const insights: MetaInsight[] = insightsRes.data ?? [];

      // --- Step 3: Fetch ad sets to find product links ---
      const adSetsRes = await graphFetch<{ data: MetaAdSet[] }>(
        `/${account.id}/adsets`,
        accessToken,
        {
          fields: "id,name,promoted_object",
          limit: "500"
        }
      );

      const adSetMap = new Map<string, MetaAdSet>();
      for (const adset of adSetsRes.data ?? []) {
        adSetMap.set(adset.id, adset);
      }

      // --- Step 4: Match insights to products ---
      for (const insight of insights) {
        const purchases = (insight.actions ?? [])
          .filter((a) => a.action_type === "purchase")
          .reduce((sum, a) => sum + parseFloat(a.value), 0);

        const purchaseRoas = insight.purchase_roas?.[0]
          ? parseFloat(insight.purchase_roas[0].value)
          : 0;

        const spend = parseFloat(insight.spend);
        const impressions = parseInt(insight.impressions, 10);
        const clicks = parseInt(insight.clicks, 10);
        const ctr = parseFloat(insight.ctr) / 100; // API returns percentage

        if (spend === 0) continue;

        // Try to link via product_id in insight
        const productExternalId = insight.product_id;

        let productMeta = productExternalId
          ? await prisma.productMeta.findFirst({
              where: { storeId, externalId: productExternalId }
            })
          : null;

        // If not matched, try store-level aggregate: update all products proportionally
        // (This is the fallback for when Meta doesn't break down by product)
        if (!productMeta && !productExternalId) {
          // Store-level ad data — distribute across all products proportionally by revenue
          const products = await prisma.productMeta.findMany({
            where: { storeId },
            include: {
              dailyMetrics: {
                where: { date: today },
                take: 1
              }
            }
          });

          const totalRevenue = products.reduce(
            (sum, p) => sum + (p.dailyMetrics[0]?.revenue ?? 0),
            0
          );

          if (totalRevenue > 0) {
            for (const product of products) {
              const productRevenue = product.dailyMetrics[0]?.revenue ?? 0;
              if (productRevenue === 0) continue;

              const share = productRevenue / totalRevenue;
              const productSpend = spend * share;
              const productImpressions = Math.round(impressions * share);
              const productClicks = Math.round(clicks * share);
              const blendedRoas = productRevenue > 0 && productSpend > 0
                ? productRevenue / productSpend
                : purchaseRoas;

              await prisma.dailyMetric.upsert({
                where: {
                  storeId_productId_date: { storeId, productId: product.id, date: today }
                },
                create: {
                  date: today,
                  roas: purchaseRoas,
                  blendedRoas,
                  ctr,
                  conversionRate: productClicks > 0 ? purchases * share / productClicks : 0,
                  margin: 0.35,
                  velocity: productRevenue / 30,
                  spend: productSpend,
                  revenue: productRevenue,
                  impressions: productImpressions,
                  clicks: productClicks,
                  conversions: Math.round(purchases * share),
                  storeId,
                  productId: product.id
                },
                update: {
                  roas: purchaseRoas,
                  blendedRoas,
                  ctr,
                  spend: productSpend,
                  impressions: productImpressions,
                  clicks: productClicks,
                  conversions: Math.round(purchases * share),
                  conversionRate: productClicks > 0 ? purchases * share / productClicks : 0
                }
              });

              totalMatched++;
            }
          }

          continue;
        }

        if (!productMeta) continue;

        // Get today's revenue for this product
        const existingMetric = await prisma.dailyMetric.findUnique({
          where: { storeId_productId_date: { storeId, productId: productMeta.id, date: today } }
        });

        const revenue = existingMetric?.revenue ?? 0;
        const blendedRoas = revenue > 0 && spend > 0
          ? revenue / spend
          : purchaseRoas;

        await prisma.dailyMetric.upsert({
          where: {
            storeId_productId_date: { storeId, productId: productMeta.id, date: today }
          },
          create: {
            date: today,
            roas: purchaseRoas,
            blendedRoas,
            ctr,
            conversionRate: clicks > 0 ? purchases / clicks : 0,
            margin: existingMetric?.margin ?? 0.35,
            velocity: revenue / 30,
            spend,
            revenue,
            impressions,
            clicks,
            conversions: Math.round(purchases),
            storeId,
            productId: productMeta.id
          },
          update: {
            roas: purchaseRoas,
            blendedRoas,
            ctr,
            spend,
            impressions,
            clicks,
            conversions: Math.round(purchases),
            conversionRate: clicks > 0 ? purchases / clicks : 0
          }
        });

        totalMatched++;
      }
    } catch (err) {
      // Don't fail the whole sync if one ad account errors
      console.error(`Meta sync error for account ${account.account_id}:`, err);
    }
  }

  return { adAccounts: adAccounts.length, insightsMatched: totalMatched };
}
