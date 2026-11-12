-- TEST CANDIDATE ONLY. Not part of prisma/migrations and not approved for shared DBs.
-- Final tenant-key transition. Application tenant/membership cutover is required
-- before deploying this SQL; the old application cannot manage independent agencies.
ALTER TABLE "AgencyProfile" ADD COLUMN "id" UUID;
UPDATE "AgencyProfile" SET "id" = "userId" WHERE "id" IS NULL;
ALTER TABLE "AgencyProfile" ALTER COLUMN "id" SET NOT NULL;
CREATE UNIQUE INDEX "AgencyProfile_id_candidate_key" ON "AgencyProfile"("id");
ALTER TABLE "AgencyProfile" ADD CONSTRAINT "AgencyProfile_legacy_user_key" UNIQUE ("userId");
ALTER TABLE "AgencyProfile" DROP CONSTRAINT "AgencyProfile_pkey";
ALTER TABLE "AgencyProfile" ADD CONSTRAINT "AgencyProfile_pkey" PRIMARY KEY USING INDEX "AgencyProfile_id_candidate_key";
ALTER TABLE "AgencyProfile" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "AgencyProfile" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "AgencyProfile" DROP CONSTRAINT "AgencyProfile_userId_fkey";
ALTER TABLE "AgencyProfile" ADD CONSTRAINT "AgencyProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT;

CREATE TYPE "AgencyMemberRole" AS ENUM ('OWNER', 'MANAGER', 'STAFF', 'ACCOUNTANT');
CREATE TYPE "AgencyMemberStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REMOVED');
CREATE TYPE "AgencyInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
CREATE TABLE "AgencyMember" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "agencyId" UUID NOT NULL REFERENCES "AgencyProfile"("id") ON DELETE RESTRICT,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "role" "AgencyMemberRole" NOT NULL,
  "status" "AgencyMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgencyMember_agencyId_userId_key" UNIQUE ("agencyId", "userId")
);
CREATE INDEX "AgencyMember_userId_status_agencyId_idx" ON "AgencyMember"("userId", "status", "agencyId");
CREATE INDEX "AgencyMember_agencyId_status_role_idx" ON "AgencyMember"("agencyId", "status", "role");
INSERT INTO "AgencyMember" ("agencyId", "userId", "role")
  SELECT a."id", a."userId", 'OWNER' FROM "AgencyProfile" a
  JOIN "User" u ON u."id" = a."userId" WHERE u."role" = 'AGENCY';

CREATE TABLE "AgencyInvitation" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "agencyId" UUID NOT NULL REFERENCES "AgencyProfile"("id") ON DELETE RESTRICT,
  "email" TEXT NOT NULL,
  "role" "AgencyMemberRole" NOT NULL,
  "status" "AgencyInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "tokenHash" TEXT NOT NULL UNIQUE,
  "invitedByUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "acceptedByUserId" UUID REFERENCES "User"("id") ON DELETE RESTRICT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("email" = lower(btrim("email"))),
  CHECK ("role" <> 'OWNER'),
  CHECK ("expiresAt" > "createdAt"),
  CHECK (("status" = 'ACCEPTED') = ("acceptedAt" IS NOT NULL AND "acceptedByUserId" IS NOT NULL))
);
CREATE UNIQUE INDEX "AgencyInvitation_pending_email_key" ON "AgencyInvitation"("agencyId", "email") WHERE "status" = 'PENDING';
CREATE INDEX "AgencyInvitation_email_status_idx" ON "AgencyInvitation"("email", "status");

-- Only ownership FKs: historical orphan users/review bookings are not rewritten.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['Tour','Booking','ETicket','Review','Report',
    'ComplaintTicket','ComplaintFeedback','Earning','GuidePayoutLedger','PremiumContribution']
  LOOP
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("agencyId") REFERENCES "AgencyProfile"("id") ON DELETE RESTRICT', t, t || '_agencyId_fkey');
  END LOOP;
END $$;
