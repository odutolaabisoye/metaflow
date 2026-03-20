-- Variant/parent hierarchy on ProductMeta
-- isVariant: true when this row represents a variant (not the parent rollup)
-- parentId: FK to the parent ProductMeta row (null for top-level products)
ALTER TABLE "ProductMeta" ADD COLUMN "isVariant" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProductMeta" ADD COLUMN "parentId"  TEXT;

ALTER TABLE "ProductMeta"
  ADD CONSTRAINT "ProductMeta_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "ProductMeta"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ProductMeta_storeId_isVariant_idx" ON "ProductMeta"("storeId", "isVariant");
CREATE INDEX "ProductMeta_storeId_parentId_idx"  ON "ProductMeta"("storeId", "parentId");
