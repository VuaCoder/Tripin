CREATE TABLE "GuidePayoutLedger" (
  "id" UUID PRIMARY KEY,
  "earningId" UUID NOT NULL UNIQUE REFERENCES "Earning"("id") ON DELETE RESTRICT,
  "guideId" UUID NOT NULL,
  "agencyId" UUID NOT NULL,
  "tourId" UUID NOT NULL,
  "amount" BIGINT NOT NULL CHECK ("amount" >= 0),
  "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING', 'TRANSFERRED')),
  "transferReference" TEXT,
  "transferredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (("status" = 'PENDING' AND "transferredAt" IS NULL AND "transferReference" IS NULL)
    OR ("status" = 'TRANSFERRED' AND "transferredAt" IS NOT NULL AND LENGTH(TRIM("transferReference")) >= 3))
);
CREATE INDEX "GuidePayoutLedger_guideId_createdAt_idx" ON "GuidePayoutLedger"("guideId", "createdAt" DESC);
INSERT INTO "GuidePayoutLedger" ("id", "earningId", "guideId", "agencyId", "tourId", "amount", "createdAt")
  SELECT "id", "id", "guideId", "agencyId", "tourId", "amount", "earnedAt" FROM "Earning";
