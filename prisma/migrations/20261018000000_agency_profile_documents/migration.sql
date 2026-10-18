-- These nullable fields already exist in schema.prisma and are read during
-- authentication. Keep databases recreated from migrations in sync with Prisma.
ALTER TABLE "AgencyProfile" ADD COLUMN IF NOT EXISTS "taxId" TEXT;
ALTER TABLE "AgencyProfile" ADD COLUMN IF NOT EXISTS "businessLicenseUrl" TEXT;
