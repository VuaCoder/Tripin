ALTER TABLE "Tour"
ADD COLUMN "childPricingPolicy" TEXT,
ADD COLUMN "cancellationPolicy" TEXT,
ADD COLUMN "travelNotes" TEXT,
ADD COLUMN "requiredDocuments" TEXT;
ALTER TABLE "Tour" ADD COLUMN "agePricing" JSONB;
ALTER TABLE "Booking" ADD COLUMN "guestPricing" JSONB;
ALTER TABLE "CartItem" ADD COLUMN "guestCounts" JSONB;
