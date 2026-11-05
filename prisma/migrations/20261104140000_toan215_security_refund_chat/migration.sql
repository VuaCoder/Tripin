-- TOAN-13: invalidate JWTs after logout / password change
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- Conversation read watermarks
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "lastReadTravelerAt" TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "lastReadGuideAt" TIMESTAMP(3);

-- Booking refund amount snapshot
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "refundAmount" INTEGER;

-- Refund ledger
CREATE TABLE IF NOT EXISTS "RefundLedger" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "bookingId" UUID,
  "paymentId" UUID,
  "complaintTicketId" UUID,
  "userId" UUID NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "reason" TEXT NOT NULL,
  "destinationHint" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "RefundLedger_status_createdAt_idx" ON "RefundLedger" ("status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "RefundLedger_userId_createdAt_idx" ON "RefundLedger" ("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "RefundLedger_bookingId_idx" ON "RefundLedger" ("bookingId");
