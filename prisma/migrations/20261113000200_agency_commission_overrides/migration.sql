ALTER TABLE "AgencyProfile"
  ADD COLUMN "commissionRateBps" INTEGER,
  ADD COLUMN "commissionVersion" INTEGER NOT NULL DEFAULT 0;
