-- AlterTable
ALTER TABLE "ProductMeta" ADD COLUMN     "isVariant" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "ProductMeta_parentId_idx" ON "ProductMeta"("parentId");

-- AddForeignKey
ALTER TABLE "ProductMeta" ADD CONSTRAINT "ProductMeta_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProductMeta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
