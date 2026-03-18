-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "lastSyncError" TEXT,
ADD COLUMN     "lastSyncProvider" TEXT,
ADD COLUMN     "lastSyncStatus" TEXT NOT NULL DEFAULT 'IDLE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "frozenAt" TIMESTAMP(3),
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);
