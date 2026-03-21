-- AlterTable
ALTER TABLE "ProductMeta" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "lastRollupAt" TIMESTAMP(3),
ADD COLUMN     "lastRollupError" TEXT,
ADD COLUMN     "lastRollupStatus" TEXT NOT NULL DEFAULT 'IDLE';

-- CreateTable
CREATE TABLE "ProductRollupDaily" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metaRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "addToCart" INTEGER NOT NULL DEFAULT 0,
    "addToCartOmni" INTEGER NOT NULL DEFAULT 0,
    "checkoutInitiated" INTEGER NOT NULL DEFAULT 0,
    "checkoutInitiatedOmni" INTEGER NOT NULL DEFAULT 0,
    "marginWeightedSum" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marginWeight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "ProductRollupDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductRollupDaily_storeId_date_idx" ON "ProductRollupDaily"("storeId", "date");

-- CreateIndex
CREATE INDEX "ProductRollupDaily_storeId_productId_date_idx" ON "ProductRollupDaily"("storeId", "productId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRollupDaily_storeId_productId_date_key" ON "ProductRollupDaily"("storeId", "productId", "date");

-- CreateIndex
CREATE INDEX "ProductMeta_storeId_isActive_idx" ON "ProductMeta"("storeId", "isActive");

-- AddForeignKey
ALTER TABLE "ProductRollupDaily" ADD CONSTRAINT "ProductRollupDaily_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRollupDaily" ADD CONSTRAINT "ProductRollupDaily_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProductMeta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
