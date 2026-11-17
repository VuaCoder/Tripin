ALTER TABLE "AgencyFinancePolicy"
 ADD COLUMN "autoSettlement" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "minWithdrawal" BIGINT NOT NULL DEFAULT 100000,
 ADD COLUMN "maxWithdrawal" BIGINT NOT NULL DEFAULT 500000000,
 ADD COLUMN "dailyWithdrawalLimit" BIGINT NOT NULL DEFAULT 1000000000,
 ADD COLUMN "processingHours" INTEGER NOT NULL DEFAULT 48,
 ADD CONSTRAINT finance_withdrawal_policy_check CHECK("minWithdrawal">0 AND "maxWithdrawal">="minWithdrawal" AND "dailyWithdrawalLimit">="maxWithdrawal" AND "processingHours" BETWEEN 1 AND 720);
CREATE TABLE "AgencySettlementPolicyVersion" (
 id UUID PRIMARY KEY, "effectiveAt" TIMESTAMP(3) NOT NULL, snapshot JSONB NOT NULL,
 "actorId" UUID NOT NULL REFERENCES "User"(id), reason TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AgencySettlementPolicyVersion_effectiveAt_createdAt_idx" ON "AgencySettlementPolicyVersion"("effectiveAt","createdAt");
CREATE TRIGGER finance_policy_version_immutable BEFORE UPDATE OR DELETE ON "AgencySettlementPolicyVersion" FOR EACH ROW EXECUTE FUNCTION finance_no_rewrite();
CREATE TABLE "AgencyFinanceSource" (
 "paymentId" UUID PRIMARY KEY REFERENCES "Payment"(id), origin TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK(origin IN ('LIVE','TEST','UNKNOWN')),
 "verifiedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Only the explicitly identified fixture provider is classified TEST. Historical money is not silently verified.
INSERT INTO "AgencyFinanceSource"("paymentId",origin)
 SELECT id,CASE WHEN provider='TEST-FINANCE' THEN 'TEST' ELSE 'UNKNOWN' END FROM "Payment" WHERE purpose='BOOKING';
CREATE TABLE "AgencySettlement" (
 id UUID PRIMARY KEY, "bookingId" UUID NOT NULL UNIQUE REFERENCES "Booking"(id), "agencyId" UUID NOT NULL REFERENCES "AgencyProfile"(id),
 origin TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK(origin IN ('LIVE','TEST','UNKNOWN')),
 "policyVersionId" UUID REFERENCES "AgencySettlementPolicyVersion"(id), "policySnapshot" JSONB NOT NULL,
 "eligibleAt" TIMESTAMP(3), "releasedAt" TIMESTAMP(3), amount BIGINT NOT NULL DEFAULT 0 CHECK(amount>=0),
 reasons JSONB NOT NULL DEFAULT '[]', "checkedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AgencySettlement_agencyId_createdAt_idx" ON "AgencySettlement"("agencyId","createdAt");
CREATE INDEX "AgencySettlement_releasedAt_checkedAt_idx" ON "AgencySettlement"("releasedAt","checkedAt");
CREATE TABLE "AgencyWithdrawal" (
 id UUID PRIMARY KEY, "agencyId" UUID NOT NULL REFERENCES "AgencyProfile"(id), amount BIGINT NOT NULL CHECK(amount>0),
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','PROCESSING','COMPLETED','REJECTED','CANCELLED','FAILED')),
 "requestKey" TEXT NOT NULL, "requestedBy" UUID NOT NULL REFERENCES "User"(id), "approvedBy" UUID REFERENCES "User"(id), "processedBy" UUID REFERENCES "User"(id),
 "bankSnapshot" JSONB NOT NULL, "bankRef" TEXT UNIQUE, "proofId" UUID REFERENCES "AgencyFinanceDocument"(id), note TEXT,
 "transferredAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE("agencyId","requestKey")
);
CREATE INDEX "AgencyWithdrawal_agencyId_status_createdAt_idx" ON "AgencyWithdrawal"("agencyId",status,"createdAt");
CREATE TABLE "AgencyWithdrawalAllocation" (
 id UUID PRIMARY KEY, "withdrawalId" UUID NOT NULL REFERENCES "AgencyWithdrawal"(id), "bookingId" UUID NOT NULL REFERENCES "Booking"(id),
 amount BIGINT NOT NULL CHECK(amount>0), UNIQUE("withdrawalId","bookingId")
);
CREATE INDEX "AgencyWithdrawalAllocation_bookingId_idx" ON "AgencyWithdrawalAllocation"("bookingId");
CREATE TRIGGER finance_withdrawal_allocation_immutable BEFORE UPDATE OR DELETE ON "AgencyWithdrawalAllocation" FOR EACH ROW EXECUTE FUNCTION finance_no_rewrite();
CREATE TABLE "AgencyFinanceWorker" (
 id TEXT PRIMARY KEY DEFAULT 'settlement', "lastStartedAt" TIMESTAMP(3), "lastSucceededAt" TIMESTAMP(3), "lastError" TEXT, processed INTEGER NOT NULL DEFAULT 0
);
-- Prevent legacy workers from paying a booking after V2 has released its balance.
CREATE FUNCTION finance_reject_legacy_wallet_payout() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM "AgencySettlement" s WHERE s."bookingId"=NEW."bookingId" AND s."releasedAt" IS NOT NULL) THEN
  RAISE EXCEPTION 'Booking uses settlement wallet; use withdrawal requests';
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER finance_legacy_wallet_payout_guard BEFORE INSERT ON "AgencyPayoutItem" FOR EACH ROW EXECUTE FUNCTION finance_reject_legacy_wallet_payout();
-- Source receipt changes participate in the same organization lock as releases and withdrawals.
CREATE TRIGGER finance_receipt_source_lock BEFORE INSERT OR UPDATE ON "AgencyFinanceReceipt" FOR EACH ROW EXECUTE FUNCTION finance_lock_source_agency();
UPDATE "AgencyRole" SET permissions=array_append(permissions,'agency:finance-withdraw') WHERE "systemRole"='OWNER' AND NOT ('agency:finance-withdraw'=ANY(permissions));
UPDATE "AgencyProfile" SET "permissionVersion"="permissionVersion"+1;
CREATE FUNCTION finance_owner_withdraw_default() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW."systemRole"='OWNER' AND NOT ('agency:finance-withdraw'=ANY(NEW.permissions)) THEN NEW.permissions=array_append(NEW.permissions,'agency:finance-withdraw'); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER finance_owner_withdraw_default BEFORE INSERT ON "AgencyRole" FOR EACH ROW EXECUTE FUNCTION finance_owner_withdraw_default();
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FINANCE_SETTLED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FINANCE_WITHDRAWAL_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FINANCE_WITHDRAWAL_REQUESTED';
