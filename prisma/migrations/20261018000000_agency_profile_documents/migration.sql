-- Keep AgencyProfile in sync with the optional onboarding document fields.
ALTER TABLE "AgencyProfile"
ADD COLUMN "taxId" TEXT,
ADD COLUMN "businessLicenseUrl" TEXT;
