CREATE TABLE "GuidePayoutAccount" (
  "guideId" UUID PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
  "encryptedDetails" TEXT NOT NULL,
  "keyVersion" TEXT NOT NULL,
  "last4" TEXT NOT NULL CHECK ("last4" ~ '^[0-9]{4}$'),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
