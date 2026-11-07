ALTER TABLE "Booking"
  ADD COLUMN "fulfillmentStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "fulfillmentAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "fulfillmentNextAttemptAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_fulfillmentStatus_check"
  CHECK ("fulfillmentStatus" IN ('PENDING', 'COMPLETED', 'FAILED'));
UPDATE "Booking" b SET "fulfillmentStatus" = 'COMPLETED'
  WHERE EXISTS (SELECT 1 FROM "ETicket" t WHERE t."bookingId" = b.id);
CREATE INDEX "Booking_status_fulfillmentStatus_fulfillmentNextAttemptAt_idx"
  ON "Booking"("status", "fulfillmentStatus", "fulfillmentNextAttemptAt");
