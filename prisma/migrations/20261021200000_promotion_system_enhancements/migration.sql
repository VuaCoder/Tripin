-- CreateEnum
CREATE TYPE "PromotionApplyType" AS ENUM ('CODE', 'AUTO_APPLY', 'COLLECTABLE');

-- CreateEnum
CREATE TYPE "PromotionCodeType" AS ENUM ('SHARED', 'UNIQUE_BATCH');

-- AlterTable
ALTER TABLE "Promotion" ALTER COLUMN "code" DROP NOT NULL;
ALTER TABLE "Promotion" ADD COLUMN "applyType" "PromotionApplyType" NOT NULL DEFAULT 'CODE';
ALTER TABLE "Promotion" ADD COLUMN "codeType" "PromotionCodeType" NOT NULL DEFAULT 'SHARED';
ALTER TABLE "Promotion" ADD COLUMN "minParticipants" INTEGER;
ALTER TABLE "Promotion" ADD COLUMN "daysInAdvance" INTEGER;
ALTER TABLE "Promotion" ADD COLUMN "firstBookingOnly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Promotion" ADD COLUMN "targetTourIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Promotion" ADD COLUMN "usageLimitPerUser" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "PromotionCodeInstance" (
    "id" UUID NOT NULL,
    "promotionId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedById" UUID,
    "usedAt" TIMESTAMP(3),
    "bookingId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionCodeInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserVoucher" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "promotionId" UUID NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "bookingId" UUID,

    CONSTRAINT "UserVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Promotion_applyType_isActive_idx" ON "Promotion"("applyType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionCodeInstance_code_key" ON "PromotionCodeInstance"("code");

-- CreateIndex
CREATE INDEX "PromotionCodeInstance_promotionId_isUsed_idx" ON "PromotionCodeInstance"("promotionId", "isUsed");

-- CreateIndex
CREATE INDEX "PromotionCodeInstance_code_idx" ON "PromotionCodeInstance"("code");

-- CreateIndex
CREATE UNIQUE INDEX "UserVoucher_userId_promotionId_key" ON "UserVoucher"("userId", "promotionId");

-- CreateIndex
CREATE INDEX "UserVoucher_userId_isUsed_idx" ON "UserVoucher"("userId", "isUsed");

-- AddForeignKey
ALTER TABLE "PromotionCodeInstance" ADD CONSTRAINT "PromotionCodeInstance_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserVoucher" ADD CONSTRAINT "UserVoucher_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
