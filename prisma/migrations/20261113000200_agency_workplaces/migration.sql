ALTER TYPE "NotificationType" ADD VALUE 'AGENCY_JOIN_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'AGENCY_JOIN_REVIEWED';
BEGIN;
CREATE TABLE "AgencyCreationKey" (
  "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  key UUID NOT NULL,
  "agencyId" UUID NOT NULL UNIQUE REFERENCES "AgencyProfile"(id) ON DELETE RESTRICT,
  PRIMARY KEY ("userId", key)
);
CREATE TABLE "AgencyJoinCode" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "agencyId" UUID NOT NULL REFERENCES "AgencyProfile"(id) ON DELETE RESTRICT,
  "codeHash" TEXT NOT NULL UNIQUE,
  "createdByUserId" UUID NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "AgencyJoinCode_expiry_check" CHECK ("expiresAt">"createdAt"),
  CONSTRAINT "AgencyJoinCode_agencyId_id_key" UNIQUE ("agencyId", id)
);
CREATE UNIQUE INDEX "AgencyJoinCode_current_key" ON "AgencyJoinCode"("agencyId") WHERE "revokedAt" IS NULL;
CREATE INDEX "AgencyJoinCode_agencyId_createdAt_idx" ON "AgencyJoinCode"("agencyId", "createdAt");
CREATE TABLE "AgencyJoinRequest" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "agencyId" UUID NOT NULL REFERENCES "AgencyProfile"(id) ON DELETE RESTRICT,
  "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  "joinCodeId" UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedByUserId" UUID REFERENCES "User"(id) ON DELETE RESTRICT,
  "assignedRoleId" UUID,
  "cancelledAt" TIMESTAMP(3),
  CONSTRAINT "AgencyJoinRequest_code_fkey" FOREIGN KEY ("agencyId", "joinCodeId") REFERENCES "AgencyJoinCode"("agencyId", id) ON DELETE RESTRICT,
  CONSTRAINT "AgencyJoinRequest_role_fkey" FOREIGN KEY ("agencyId", "assignedRoleId") REFERENCES "AgencyRole"("agencyId", id) ON DELETE RESTRICT,
  CONSTRAINT "AgencyJoinRequest_state_check" CHECK (
    (status='PENDING' AND "reviewedAt" IS NULL AND "reviewedByUserId" IS NULL AND "assignedRoleId" IS NULL AND "cancelledAt" IS NULL) OR
    (status='APPROVED' AND "reviewedAt" IS NOT NULL AND "reviewedByUserId" IS NOT NULL AND "assignedRoleId" IS NOT NULL AND "cancelledAt" IS NULL) OR
    (status='REJECTED' AND "reviewedAt" IS NOT NULL AND "reviewedByUserId" IS NOT NULL AND "assignedRoleId" IS NULL AND "cancelledAt" IS NULL) OR
    (status='CANCELLED' AND "reviewedAt" IS NULL AND "reviewedByUserId" IS NULL AND "assignedRoleId" IS NULL AND "cancelledAt" IS NOT NULL)
  )
);
CREATE UNIQUE INDEX "AgencyJoinRequest_pending_key" ON "AgencyJoinRequest"("agencyId", "userId") WHERE status='PENDING';
CREATE INDEX "AgencyJoinRequest_agencyId_status_createdAt_idx" ON "AgencyJoinRequest"("agencyId", status, "createdAt");
CREATE INDEX "AgencyJoinRequest_userId_createdAt_idx" ON "AgencyJoinRequest"("userId", "createdAt");
COMMIT;
