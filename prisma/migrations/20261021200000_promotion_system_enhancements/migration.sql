-- CreateEnum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PromotionApplyType') THEN
    CREATE TYPE "PromotionApplyType" AS ENUM ('CODE', 'AUTO_APPLY', 'COLLECTABLE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PromotionCodeType') THEN
    CREATE TYPE "PromotionCodeType" AS ENUM ('SHARED', 'UNIQUE_BATCH');
  END IF;
END $$;

-- AlterTable
ALTER TABLE "Promotion" ALTER COLUMN "code" DROP NOT NULL;
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "applyType" "PromotionApplyType" NOT NULL DEFAULT 'CODE';
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "codeType" "PromotionCodeType" NOT NULL DEFAULT 'SHARED';
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "minParticipants" INTEGER;
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "daysInAdvance" INTEGER;
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "firstBookingOnly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "targetTourIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "usageLimitPerUser" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PromotionCodeInstance" (
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
CREATE TABLE IF NOT EXISTS "UserVoucher" (
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
CREATE INDEX IF NOT EXISTS "Promotion_applyType_isActive_idx" ON "Promotion"("applyType", "isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Promotion_isArchived_idx" ON "Promotion"("isArchived");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PromotionCodeInstance_code_key" ON "PromotionCodeInstance"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PromotionCodeInstance_promotionId_isUsed_idx" ON "PromotionCodeInstance"("promotionId", "isUsed");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PromotionCodeInstance_code_idx" ON "PromotionCodeInstance"("code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserVoucher_userId_promotionId_key" ON "UserVoucher"("userId", "promotionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserVoucher_userId_isUsed_idx" ON "UserVoucher"("userId", "isUsed");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromotionCodeInstance_promotionId_fkey') THEN
    ALTER TABLE "PromotionCodeInstance" ADD CONSTRAINT "PromotionCodeInstance_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserVoucher_promotionId_fkey') THEN
    ALTER TABLE "UserVoucher" ADD CONSTRAINT "UserVoucher_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
