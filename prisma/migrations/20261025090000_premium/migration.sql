-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "premiumVoucherId" UUID;

-- AlterTable
ALTER TABLE "SubscriptionPlan" ADD COLUMN     "audience" "Role" NOT NULL DEFAULT 'TOUR_GUIDE',
ADD COLUMN     "isPremium" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "audience" "Role" NOT NULL DEFAULT 'TOUR_GUIDE',
ADD COLUMN     "benefitsGrantedAt" TIMESTAMP(3),
ADD COLUMN     "entitlementSnapshot" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "isPremium" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "planVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "revokedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PremiumContribution" (
    "id" UUID NOT NULL,
    "agencyId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "tourIds" TEXT[],
    "discountType" "DiscountType" NOT NULL,
    "discountValue" INTEGER NOT NULL,
    "maxDiscountAmount" INTEGER,
    "minOrderAmount" INTEGER NOT NULL DEFAULT 0,
    "capacity" INTEGER NOT NULL,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "acceptingNew" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PremiumContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PremiumPlanVoucher" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "contributionId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "PremiumPlanVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PremiumReservation" (
    "id" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "contributionId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "terms" JSONB NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'HELD',
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PremiumReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PremiumVoucher" (
    "id" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "contributionId" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "terms" JSONB NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "bookingId" UUID,
    "heldAt" TIMESTAMP(3),
    "leaseToken" UUID,

    CONSTRAINT "PremiumVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PremiumRefund" (
    "id" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "decisionNote" TEXT,
    "reviewedBy" UUID,
    "transferReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PremiumRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PremiumGuideProfile" (
    "userId" UUID NOT NULL,
    "introduction" TEXT NOT NULL DEFAULT '',
    "portfolio" JSONB NOT NULL DEFAULT '[]',
    "certificates" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PremiumGuideProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "PremiumGuideActivity" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tourId" UUID NOT NULL,
    "tourTitle" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "bookingId" UUID,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PremiumGuideActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PremiumContribution_agencyId_createdAt_idx" ON "PremiumContribution"("agencyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PremiumPlanVoucher_planId_contributionId_key" ON "PremiumPlanVoucher"("planId", "contributionId");

-- CreateIndex
CREATE INDEX "PremiumReservation_state_expiresAt_idx" ON "PremiumReservation"("state", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PremiumReservation_subscriptionId_contributionId_key" ON "PremiumReservation"("subscriptionId", "contributionId");

-- CreateIndex
CREATE UNIQUE INDEX "PremiumVoucher_bookingId_key" ON "PremiumVoucher"("bookingId");

-- CreateIndex
CREATE INDEX "PremiumVoucher_userId_endsAt_idx" ON "PremiumVoucher"("userId", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "PremiumVoucher_subscriptionId_contributionId_ordinal_key" ON "PremiumVoucher"("subscriptionId", "contributionId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "PremiumRefund_subscriptionId_key" ON "PremiumRefund"("subscriptionId");

-- CreateIndex
CREATE INDEX "PremiumRefund_status_createdAt_idx" ON "PremiumRefund"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PremiumGuideActivity_bookingId_key" ON "PremiumGuideActivity"("bookingId");

-- CreateIndex
CREATE INDEX "PremiumGuideActivity_userId_occurredAt_idx" ON "PremiumGuideActivity"("userId", "occurredAt");

-- AddForeignKey
ALTER TABLE "PremiumPlanVoucher" ADD CONSTRAINT "PremiumPlanVoucher_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PremiumPlanVoucher" ADD CONSTRAINT "PremiumPlanVoucher_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "PremiumContribution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PremiumReservation" ADD CONSTRAINT "PremiumReservation_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PremiumReservation" ADD CONSTRAINT "PremiumReservation_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "PremiumContribution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PremiumVoucher" ADD CONSTRAINT "PremiumVoucher_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PremiumRefund" ADD CONSTRAINT "PremiumRefund_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Premium invariants remain protected when workers or nodes run concurrently.
ALTER TABLE "SubscriptionPlan" ADD CONSTRAINT "premium_plan_valid" CHECK (NOT "isPremium" OR (price > 0 AND "durationDays" > 0 AND version > 0 AND audience IN ('TRAVELER','TOUR_GUIDE')));
ALTER TABLE "PremiumContribution" ADD CONSTRAINT "premium_capacity_valid" CHECK (capacity > 0 AND reserved >= 0 AND reserved <= capacity), ADD CONSTRAINT "premium_contribution_status" CHECK (status IN ('PENDING','APPROVED','REJECTED'));
ALTER TABLE "PremiumPlanVoucher" ADD CONSTRAINT "premium_plan_quantity_valid" CHECK (quantity > 0);
ALTER TABLE "PremiumReservation" ADD CONSTRAINT "premium_reservation_valid" CHECK (quantity > 0 AND state IN ('HELD','COMMITTED','RELEASED'));
ALTER TABLE "PremiumVoucher" ADD CONSTRAINT "premium_voucher_period_valid" CHECK ("startsAt" < "endsAt"), ADD CONSTRAINT "premium_voucher_lease_valid" CHECK (("heldAt" IS NULL) = ("leaseToken" IS NULL) AND ("bookingId" IS NULL OR "heldAt" IS NOT NULL));
ALTER TABLE "PremiumRefund" ADD CONSTRAINT "premium_refund_valid" CHECK (amount > 0 AND status IN ('REQUESTED','APPROVED','REJECTED','COMPLETED')), ADD CONSTRAINT "premium_refund_transfer_required" CHECK (status <> 'COMPLETED' OR "transferReference" IS NOT NULL);
CREATE INDEX "Subscription_premium_current_idx" ON "Subscription" ("userId", audience, "startsAt", "endsAt") WHERE "isPremium" = true AND "revokedAt" IS NULL AND status = 'ACTIVE';
