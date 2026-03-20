-- 7-day pre-computed aggregate columns on ProductMeta
-- Mirrors the existing 30d columns; written by the scoring job after every sync.
ALTER TABLE "ProductMeta" ADD COLUMN "spend7d"       DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "ProductMeta" ADD COLUMN "revenue7d"     DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "ProductMeta" ADD COLUMN "metaRevenue7d" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "ProductMeta" ADD COLUMN "impressions7d" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProductMeta" ADD COLUMN "clicks7d"      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProductMeta" ADD COLUMN "conversions7d" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProductMeta" ADD COLUMN "roas7d"        DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "ProductMeta" ADD COLUMN "ctr7d"         DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "ProductMeta" ADD COLUMN "addToCart7d"             INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProductMeta" ADD COLUMN "addToCartOmni7d"         INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProductMeta" ADD COLUMN "checkoutInitiated7d"     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProductMeta" ADD COLUMN "checkoutInitiatedOmni7d" INTEGER NOT NULL DEFAULT 0;

-- Missing sort indexes for 30d columns (used in fast-path DB-level sort)
CREATE INDEX "ProductMeta_storeId_impressions30d_idx" ON "ProductMeta"("storeId", "impressions30d");
CREATE INDEX "ProductMeta_storeId_addToCartOmni30d_idx" ON "ProductMeta"("storeId", "addToCartOmni30d");

-- Sort indexes for the new 7d columns
CREATE INDEX "ProductMeta_storeId_spend7d_idx"          ON "ProductMeta"("storeId", "spend7d");
CREATE INDEX "ProductMeta_storeId_roas7d_idx"           ON "ProductMeta"("storeId", "roas7d");
CREATE INDEX "ProductMeta_storeId_impressions7d_idx"    ON "ProductMeta"("storeId", "impressions7d");
CREATE INDEX "ProductMeta_storeId_addToCartOmni7d_idx"  ON "ProductMeta"("storeId", "addToCartOmni7d");
