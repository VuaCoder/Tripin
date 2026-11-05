-- One snapshot per applied voucher; BIGINT matches the whole-VND storage contract.
CREATE TABLE "PromotionRedemption" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "promotionId" UUID NOT NULL,
    "scope" "PromotionScope" NOT NULL,
    "code" TEXT NOT NULL,
    "discountAmount" BIGINT NOT NULL,
    "codeInstanceId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromotionRedemption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PromotionRedemption_bookingId_idx" ON "PromotionRedemption"("bookingId");
CREATE INDEX "PromotionRedemption_promotionId_idx" ON "PromotionRedemption"("promotionId");
ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
