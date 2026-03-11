-- AlterTable
ALTER TABLE "Connection" ADD COLUMN     "metaAdAccountId" TEXT,
ADD COLUMN     "metaCatalogId" TEXT;

-- AlterTable
ALTER TABLE "DailyMetric" ADD COLUMN     "metaRevenue" DOUBLE PRECISION;
