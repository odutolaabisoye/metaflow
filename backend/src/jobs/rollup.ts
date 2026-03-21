import type { PrismaClient } from "@prisma/client";
import { storeLocalDayBounds } from "./dateUtils.js";

function toDateOnly(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

interface RollupJobOptions {
  storeId: string;
  days?: number; // default 90
  timezone?: string;
}

export async function runProductRollupJob(
  prisma: PrismaClient,
  opts: RollupJobOptions
): Promise<{ rows: number }> {
  const { storeId, days = 90 } = opts;
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { timezone: true }
  });
  const timezone = store?.timezone ?? opts.timezone ?? "UTC";

  const todayLocal = storeLocalDayBounds(timezone).start;
  const since = new Date(todayLocal);
  since.setDate(since.getDate() - (days - 1));

  const products = await prisma.productMeta.findMany({
    where: { storeId, isActive: true },
    select: { id: true, parentId: true, isVariant: true }
  });

  if (products.length === 0) return { rows: 0 };

  const parentIds = new Set<string>();
  const childToParent = new Map<string, string>();
  for (const p of products) {
    if (!p.isVariant) parentIds.add(p.id);
    const rootId = p.parentId ?? p.id;
    childToParent.set(p.id, rootId);
  }

  const allIds = products.map(p => p.id);

  const metrics = await prisma.dailyMetric.groupBy({
    by: ["date", "productId"],
    where: { storeId, productId: { in: allIds }, date: { gte: since } },
    _sum: {
      spend: true,
      revenue: true,
      metaRevenue: true,
      impressions: true,
      clicks: true,
      conversions: true,
      addToCart: true,
      addToCartOmni: true,
      checkoutInitiated: true,
      checkoutInitiatedOmni: true,
    }
    ,
    _avg: { margin: true }
  });

  const rollupMap = new Map<string, {
    storeId: string;
    productId: string;
    date: Date;
    spend: number;
    revenue: number;
    metaRevenue: number;
    impressions: number;
    clicks: number;
    conversions: number;
    addToCart: number;
    addToCartOmni: number;
    checkoutInitiated: number;
    checkoutInitiatedOmni: number;
    marginWeightedSum: number;
    marginWeight: number;
  }>();

  for (const m of metrics) {
    const parentId = childToParent.get(m.productId) ?? m.productId;
    if (!parentIds.has(parentId)) continue;
    const dateKey = toDateOnly(m.date).toISOString();
    const key = `${parentId}\x00${dateKey}`;
    const revenue = m._sum.revenue ?? 0;
    const margin = (m as any)._avg?.margin ?? 0.35;
    const weight = revenue > 0 ? revenue : 1;
    const existing = rollupMap.get(key);
    if (!existing) {
      rollupMap.set(key, {
        storeId,
        productId: parentId,
        date: toDateOnly(m.date),
        spend: m._sum.spend ?? 0,
        revenue,
        metaRevenue: m._sum.metaRevenue ?? 0,
        impressions: m._sum.impressions ?? 0,
        clicks: m._sum.clicks ?? 0,
        conversions: m._sum.conversions ?? 0,
        addToCart: m._sum.addToCart ?? 0,
        addToCartOmni: m._sum.addToCartOmni ?? 0,
        checkoutInitiated: m._sum.checkoutInitiated ?? 0,
        checkoutInitiatedOmni: m._sum.checkoutInitiatedOmni ?? 0,
        marginWeightedSum: margin * weight,
        marginWeight: weight,
      });
    } else {
      existing.spend += m._sum.spend ?? 0;
      existing.revenue += revenue;
      existing.metaRevenue += m._sum.metaRevenue ?? 0;
      existing.impressions += m._sum.impressions ?? 0;
      existing.clicks += m._sum.clicks ?? 0;
      existing.conversions += m._sum.conversions ?? 0;
      existing.addToCart += m._sum.addToCart ?? 0;
      existing.addToCartOmni += m._sum.addToCartOmni ?? 0;
      existing.checkoutInitiated += m._sum.checkoutInitiated ?? 0;
      existing.checkoutInitiatedOmni += m._sum.checkoutInitiatedOmni ?? 0;
      existing.marginWeightedSum += margin * weight;
      existing.marginWeight += weight;
    }
  }

  const rows = [...rollupMap.values()];

  const BATCH = 300;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    await prisma.$transaction(
      chunk.map((row) =>
        prisma.productRollupDaily.upsert({
          where: {
            storeId_productId_date: {
              storeId: row.storeId,
              productId: row.productId,
              date: row.date
            }
          },
          create: row,
          update: {
            spend: row.spend,
            revenue: row.revenue,
            metaRevenue: row.metaRevenue,
            impressions: row.impressions,
            clicks: row.clicks,
            conversions: row.conversions,
            addToCart: row.addToCart,
            addToCartOmni: row.addToCartOmni,
            checkoutInitiated: row.checkoutInitiated,
            checkoutInitiatedOmni: row.checkoutInitiatedOmni,
            marginWeightedSum: row.marginWeightedSum,
            marginWeight: row.marginWeight,
          }
        })
      )
    );
  }

  return { rows: rows.length };
}
