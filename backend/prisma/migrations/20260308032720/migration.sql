/*
  Warnings:

  - A unique constraint covering the columns `[storeId,provider]` on the table `Connection` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "ConnectionProvider" ADD VALUE 'API';

-- AlterEnum
ALTER TYPE "StorePlatform" ADD VALUE 'API';

-- DropIndex
DROP INDEX "Connection_storeId_provider_idx";

-- AlterTable
ALTER TABLE "DailyMetric" ADD COLUMN     "blendedRoas" DOUBLE PRECISION,
ADD COLUMN     "clicks" INTEGER,
ADD COLUMN     "conversions" INTEGER,
ADD COLUMN     "impressions" INTEGER;

-- AlterTable
ALTER TABLE "ProductMeta" ADD COLUMN     "imageUrl" TEXT;

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Connection_storeId_provider_key" ON "Connection"("storeId", "provider");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
