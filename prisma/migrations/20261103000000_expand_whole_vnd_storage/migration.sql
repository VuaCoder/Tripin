-- Widen storage without rewriting historical amounts or changing counts/rates.
-- Apply with the compatible backend in a maintenance window (ALTER TYPE takes locks).
ALTER TABLE "Tour" ALTER COLUMN "basePrice" TYPE BIGINT;
ALTER TABLE "TourDeparture" ALTER COLUMN "priceOverride" TYPE BIGINT;
ALTER TABLE "TourGuideAssignment" ALTER COLUMN "feePerBooking" TYPE BIGINT;
ALTER TABLE "Booking"
  ALTER COLUMN "unitPrice" TYPE BIGINT,
  ALTER COLUMN "subtotal" TYPE BIGINT,
  ALTER COLUMN "discountAmount" TYPE BIGINT,
  ALTER COLUMN "totalAmount" TYPE BIGINT,
  ALTER COLUMN "commissionAmount" TYPE BIGINT,
  ALTER COLUMN "agencyAmount" TYPE BIGINT;
ALTER TABLE "Payment" ALTER COLUMN "amount" TYPE BIGINT;
ALTER TABLE "Earning" ALTER COLUMN "amount" TYPE BIGINT;
ALTER TABLE "Promotion"
  ALTER COLUMN "discountValue" TYPE BIGINT,
  ALTER COLUMN "maxDiscountAmount" TYPE BIGINT,
  ALTER COLUMN "minOrderAmount" TYPE BIGINT;
ALTER TABLE "SubscriptionPlan" ALTER COLUMN "price" TYPE BIGINT;
ALTER TABLE "Subscription" ALTER COLUMN "price" TYPE BIGINT;
-- Do not narrow these columns on rollback once values above Int32 have been stored.
