-- AlterEnum
ALTER TYPE "AgencyVerificationStatus" ADD VALUE 'INFORMATION_REQUESTED';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ACCOUNT_UNBANNED';

-- DropIndex
DROP INDEX "AgencyProfile_verificationStatus_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "revokedPermissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "staffStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "AgencyProfile" ADD COLUMN     "submissionDateEstimated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "cancellationPolicySnapshot" JSONB;

-- AlterTable
ALTER TABLE "SupportTicket" ADD COLUMN     "resolutionNote" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "supportCode" TEXT NOT NULL DEFAULT ('SUP-'::text || upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 16)));

-- AlterTable
ALTER TABLE "ComplaintTicket" ADD COLUMN     "escalationDeadlineAt" TIMESTAMP(3),
ADD COLUMN     "escalationPolicyVersion" INTEGER,
ADD COLUMN     "escalationSlaHours" DOUBLE PRECISION,
ADD COLUMN     "slaDeadlineAt" TIMESTAMP(3),
ADD COLUMN     "slaHours" DOUBLE PRECISION,
ADD COLUMN     "slaPolicyVersion" INTEGER;

-- AlterTable
ALTER TABLE "SystemSetting" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "StaffInvitation" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyVersion" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "actorId" UUID NOT NULL,
    "rollbackOf" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyAcceptance" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "policyVersionId" UUID NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailOutbox" (
    "id" UUID NOT NULL,
    "dedupKey" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffInvitation_tokenHash_key" ON "StaffInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "StaffInvitation_userId_consumedAt_idx" ON "StaffInvitation"("userId", "consumedAt");

-- CreateIndex
CREATE INDEX "PolicyVersion_key_effectiveFrom_versionNumber_idx" ON "PolicyVersion"("key", "effectiveFrom" DESC, "versionNumber" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "PolicyVersion_key_versionNumber_key" ON "PolicyVersion"("key", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyAcceptance_userId_policyVersionId_key" ON "PolicyAcceptance"("userId", "policyVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "MailOutbox_dedupKey_key" ON "MailOutbox"("dedupKey");

-- CreateIndex
CREATE INDEX "MailOutbox_sentAt_leaseUntil_createdAt_idx" ON "MailOutbox"("sentAt", "leaseUntil", "createdAt");

-- CreateIndex
CREATE INDEX "AgencyProfile_verificationStatus_submittedAt_userId_idx" ON "AgencyProfile"("verificationStatus", "submittedAt", "userId");

-- CreateIndex
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Report_status_targetType_createdAt_idx" ON "Report"("status", "targetType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_supportCode_key" ON "SupportTicket"("supportCode");

-- Existing submission timestamps are estimates, not reconstructed historical facts.
UPDATE "AgencyProfile" a SET "submittedAt" = u."createdAt", "submissionDateEstimated" = true
FROM "User" u WHERE u.id = a."userId" AND a."submittedAt" IS NULL
AND a."verificationStatus"::text IN ('PENDING', 'VERIFIED', 'REJECTED');

-- Force pre-generation refresh sessions to sign in again at rollout.
UPDATE "RefreshToken" SET "revokedAt" = CURRENT_TIMESTAMP WHERE "revokedAt" IS NULL;

-- Record the current policy baseline without claiming an earlier effective date.
INSERT INTO "PolicyVersion" (id, key, "versionNumber", "effectiveFrom", reason, value, "actorId")
SELECT gen_random_uuid(), substring(key from 8), 0, CURRENT_TIMESTAMP,
  'Migration baseline; historical effective date unknown', value,
  COALESCE("updatedById", '00000000-0000-0000-0000-000000000000'::uuid)
FROM "SystemSetting" WHERE key IN ('policy:cancellation', 'policy:refund', 'policy:terms', 'policy:privacy', 'policy:moderation');

INSERT INTO "PolicyVersion" (id, key, "versionNumber", "effectiveFrom", reason, value, "actorId")
SELECT gen_random_uuid(), defaults.key, 0, CURRENT_TIMESTAMP, 'Initial default policy baseline', defaults.value,
  '00000000-0000-0000-0000-000000000000'::uuid
FROM (VALUES
  ('cancellation', '{"title":"Cancellation policy","content":"","params":{"cancellationWindowHours":24}}'::jsonb),
  ('refund', '{"title":"Refund policy","content":"","params":{}}'::jsonb),
  ('terms', '{"title":"Terms of service","content":"","params":{}}'::jsonb),
  ('privacy', '{"title":"Privacy policy","content":"","params":{}}'::jsonb),
  ('moderation', '{"title":"Moderation SLA","content":"","params":{"slaHours":48,"escalationSlaHours":24}}'::jsonb)
) AS defaults(key, value) ON CONFLICT (key, "versionNumber") DO NOTHING;

ALTER TABLE "User" ADD CONSTRAINT "User_staffStatus_valid" CHECK ("staffStatus" IN ('INVITED', 'ACTIVE', 'DISABLED'));
ALTER TABLE "User" ADD CONSTRAINT "User_tokenVersion_nonnegative" CHECK ("tokenVersion" >= 0);

CREATE FUNCTION prevent_policy_version_changes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Policy versions are append-only; create a rollback version instead'; END;
$$;
CREATE TRIGGER policy_versions_append_only BEFORE UPDATE OR DELETE ON "PolicyVersion"
FOR EACH ROW EXECUTE FUNCTION prevent_policy_version_changes();
