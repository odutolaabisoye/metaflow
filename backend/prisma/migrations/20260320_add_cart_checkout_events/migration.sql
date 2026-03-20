-- Add cart and checkout event columns to DailyMetric
ALTER TABLE "DailyMetric" ADD COLUMN IF NOT EXISTS "addToCart" INTEGER;
ALTER TABLE "DailyMetric" ADD COLUMN IF NOT EXISTS "addToCartOmni" INTEGER;
ALTER TABLE "DailyMetric" ADD COLUMN IF NOT EXISTS "checkoutInitiated" INTEGER;
ALTER TABLE "DailyMetric" ADD COLUMN IF NOT EXISTS "checkoutInitiatedOmni" INTEGER;

-- Add 30d pre-computed aggregates to ProductMeta
ALTER TABLE "ProductMeta" ADD COLUMN IF NOT EXISTS "addToCart30d" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProductMeta" ADD COLUMN IF NOT EXISTS "addToCartOmni30d" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProductMeta" ADD COLUMN IF NOT EXISTS "checkoutInitiated30d" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProductMeta" ADD COLUMN IF NOT EXISTS "checkoutInitiatedOmni30d" INTEGER NOT NULL DEFAULT 0;
