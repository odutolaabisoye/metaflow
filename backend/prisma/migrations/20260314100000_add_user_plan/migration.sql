-- Drop the linter-added variant columns that were reverted from schema.prisma
ALTER TABLE "ProductMeta" DROP CONSTRAINT IF EXISTS "ProductMeta_parentId_fkey";
DROP INDEX IF EXISTS "ProductMeta_parentId_idx";
ALTER TABLE "ProductMeta"
  DROP COLUMN IF EXISTS "isVariant",
  DROP COLUMN IF EXISTS "parentId";

-- CreateEnum: subscription plan tiers
CREATE TYPE "UserPlan" AS ENUM ('STARTER', 'GROWTH', 'SCALE', 'GRANDFATHERED');

-- AddColumn: set existing users to GRANDFATHERED so they keep unlimited stores
ALTER TABLE "User" ADD COLUMN "plan" "UserPlan" NOT NULL DEFAULT 'GRANDFATHERED';

-- New users going forward should start on STARTER
ALTER TABLE "User" ALTER COLUMN "plan" SET DEFAULT 'STARTER';
