BEGIN;

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AGENCY_COMMISSION_DECIDED';

CREATE TABLE "AgencyCommissionRequest" (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  "agencyId" UUID NOT NULL,
  "requestedByUserId" UUID NOT NULL,
  "currentShareBps" INTEGER NOT NULL,
  "requestedShareBps" INTEGER NOT NULL,
  "baseVersion" INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  "decidedByUserId" UUID,
  "decidedAt" TIMESTAMP(3),
  "decisionNote" TEXT,
  "appliedVersion" INTEGER,
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgencyCommissionRequest_pkey" PRIMARY KEY (id),
  CONSTRAINT "AgencyCommissionRequest_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "AgencyProfile"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "AgencyCommissionRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "AgencyCommissionRequest_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "AgencyCommissionRequest_share_check" CHECK ("currentShareBps" BETWEEN 0 AND 10000 AND "requestedShareBps" BETWEEN 0 AND 5000),
  CONSTRAINT "AgencyCommissionRequest_status_check" CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
  CONSTRAINT "AgencyCommissionRequest_reason_check" CHECK (length(btrim(reason)) BETWEEN 1 AND 1000)
);
CREATE UNIQUE INDEX "AgencyCommissionRequest_pending_agency_key" ON "AgencyCommissionRequest"("agencyId") WHERE status = 'PENDING';
CREATE INDEX "AgencyCommissionRequest_agencyId_status_createdAt_idx" ON "AgencyCommissionRequest"("agencyId","status","createdAt");
CREATE INDEX "AgencyCommissionRequest_status_createdAt_idx" ON "AgencyCommissionRequest"("status","createdAt");

COMMIT;
