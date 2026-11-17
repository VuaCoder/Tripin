-- Existing readers normalize bigint to exact safe VND numbers; writes accept integer VND.
ALTER TABLE "Booking" ALTER COLUMN "refundAmount" TYPE BIGINT;
ALTER TABLE "RefundLedger" ALTER COLUMN amount TYPE BIGINT;
CREATE TABLE "AgencyTransaction" (
  id UUID PRIMARY KEY, "agencyId" UUID NOT NULL REFERENCES "AgencyProfile"(id) ON DELETE RESTRICT ON UPDATE CASCADE, "bookingId" UUID REFERENCES "Booking"(id) ON DELETE RESTRICT ON UPDATE CASCADE, "bookingCode" TEXT,
  type TEXT NOT NULL CHECK(type IN ('PAYMENT','REFUND','PAYOUT','COMMISSION_FEE','PENALTY','ADJUSTMENT','REVERSAL')),
  amount BIGINT NOT NULL CHECK(amount>=0), currency TEXT NOT NULL DEFAULT 'VND' CHECK(currency='VND'), "eventKey" TEXT NOT NULL UNIQUE,
  "actorId" UUID, "effectiveAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, description TEXT NOT NULL
);
CREATE INDEX "AgencyTransaction_agencyId_effectiveAt_id_idx" ON "AgencyTransaction"("agencyId","effectiveAt",id);
CREATE TABLE "AgencyLedgerEntry" (
  id UUID PRIMARY KEY, "transactionId" UUID NOT NULL REFERENCES "AgencyTransaction"(id) ON DELETE RESTRICT ON UPDATE CASCADE, account TEXT NOT NULL,
  debit BIGINT NOT NULL DEFAULT 0, credit BIGINT NOT NULL DEFAULT 0,
  CHECK(debit>=0 AND credit>=0 AND NOT(debit>0 AND credit>0))
);
CREATE INDEX "AgencyLedgerEntry_transactionId_idx" ON "AgencyLedgerEntry"("transactionId");
CREATE TABLE "AgencyFinanceReceipt" (
  "paymentId" UUID PRIMARY KEY REFERENCES "Payment"(id) ON DELETE RESTRICT ON UPDATE CASCADE, "agencyId" UUID NOT NULL REFERENCES "AgencyProfile"(id) ON DELETE RESTRICT ON UPDATE CASCADE, "bookingId" UUID NOT NULL REFERENCES "Booking"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  amount BIGINT NOT NULL, "actualAmount" BIGINT NOT NULL DEFAULT 0, currency TEXT NOT NULL, "gatewayRef" TEXT,
  "reconciliationStatus" TEXT NOT NULL DEFAULT 'UNRECONCILED' CHECK("reconciliationStatus" IN ('MATCHED','DISCREPANCY','UNRECONCILED')),
  reason TEXT, "checkedAt" TIMESTAMP(3), "paidAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "AgencyFinanceReceipt_agencyId_paidAt_idx" ON "AgencyFinanceReceipt"("agencyId","paidAt");
CREATE TABLE "AgencyReconciliationRun" (
  id UUID PRIMARY KEY, "agencyId" UUID NOT NULL, "actorId" UUID NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING',
  checked INTEGER NOT NULL DEFAULT 0, matched INTEGER NOT NULL DEFAULT 0, discrepancies INTEGER NOT NULL DEFAULT 0, errors INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3)
);
CREATE INDEX "AgencyReconciliationRun_agencyId_createdAt_idx" ON "AgencyReconciliationRun"("agencyId","createdAt");
CREATE TABLE "AgencyGatewayObservation" (
  id UUID PRIMARY KEY, "paymentId" UUID NOT NULL REFERENCES "AgencyFinanceReceipt"("paymentId") ON DELETE RESTRICT ON UPDATE CASCADE, "runId" UUID NOT NULL REFERENCES "AgencyReconciliationRun"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, amount BIGINT, state TEXT NOT NULL, reason TEXT, evidence JSONB NOT NULL
);
CREATE INDEX "AgencyGatewayObservation_paymentId_observedAt_idx" ON "AgencyGatewayObservation"("paymentId","observedAt");
CREATE TABLE "FinanceOutbox" (
  "paymentId" UUID PRIMARY KEY REFERENCES "Payment"(id) ON DELETE RESTRICT ON UPDATE CASCADE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "processedAt" TIMESTAMP(3)
);
CREATE INDEX "FinanceOutbox_processedAt_createdAt_idx" ON "FinanceOutbox"("processedAt","createdAt");
CREATE TABLE "AgencyFinanceDocument" (
  id UUID PRIMARY KEY, "agencyId" UUID NOT NULL REFERENCES "AgencyProfile"(id) ON DELETE RESTRICT ON UPDATE CASCADE, name TEXT NOT NULL, "mimeType" TEXT NOT NULL,
  data BYTEA NOT NULL CHECK(octet_length(data)<=5242880), sha256 TEXT NOT NULL, "actorId" UUID NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AgencyFinanceDocument_agencyId_createdAt_idx" ON "AgencyFinanceDocument"("agencyId","createdAt");
CREATE TABLE "AgencyManualRefund" (
  id UUID PRIMARY KEY, "agencyId" UUID NOT NULL REFERENCES "AgencyProfile"(id) ON DELETE RESTRICT ON UPDATE CASCADE, "bookingId" UUID NOT NULL REFERENCES "Booking"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  amount BIGINT NOT NULL CHECK(amount>0), "commissionReversal" BIGINT NOT NULL DEFAULT 0, "paidBy" TEXT NOT NULL CHECK("paidBy" IN ('AGENCY','PLATFORM')),
  "transferredAt" TIMESTAMP(3) NOT NULL, "bankRef" TEXT NOT NULL, "proofId" UUID NOT NULL REFERENCES "AgencyFinanceDocument"(id) ON DELETE RESTRICT ON UPDATE CASCADE, reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','CONFIRMED','REJECTED')), "requestKey" TEXT NOT NULL, "actorId" UUID NOT NULL,
  "reviewedBy" UUID, "reviewedAt" TIMESTAMP(3), "reviewNote" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("agencyId","requestKey"), UNIQUE("agencyId","bankRef")
);
CREATE INDEX "AgencyManualRefund_agencyId_createdAt_idx" ON "AgencyManualRefund"("agencyId","createdAt");
CREATE TABLE "AgencyFinanceBank" (
  "agencyId" UUID PRIMARY KEY REFERENCES "AgencyProfile"(id) ON DELETE RESTRICT ON UPDATE CASCADE, "bankName" TEXT NOT NULL, "accountHolder" TEXT NOT NULL, last4 TEXT NOT NULL,
  "encryptedDetails" TEXT NOT NULL, "keyVersion" TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
  "verifiedAt" TIMESTAMP(3), "verifiedBy" UUID, "updatedBy" UUID NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "AgencyPayout" (
  id UUID PRIMARY KEY, "agencyId" UUID NOT NULL REFERENCES "AgencyProfile"(id) ON DELETE RESTRICT ON UPDATE CASCADE, "periodStart" TIMESTAMP(3) NOT NULL, "periodEnd" TIMESTAMP(3) NOT NULL,
  "totalGmv" BIGINT NOT NULL, "platformCommission" BIGINT NOT NULL, "netPayoutAmount" BIGINT NOT NULL CHECK("netPayoutAmount">0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PROCESSING','COMPLETED','CANCELLED','FAILED')),
  "bankSnapshot" JSONB NOT NULL, "bankRef" TEXT UNIQUE, "invoiceUrl" TEXT, "proofId" UUID REFERENCES "AgencyFinanceDocument"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "preparedBy" UUID NOT NULL, "approvedBy" UUID, "completedBy" UUID, "completedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK("periodEnd">"periodStart")
);
CREATE INDEX "AgencyPayout_agencyId_createdAt_idx" ON "AgencyPayout"("agencyId","createdAt");
CREATE TABLE "AgencyPayoutItem" (
  id UUID PRIMARY KEY, "payoutId" UUID NOT NULL REFERENCES "AgencyPayout"(id) ON DELETE RESTRICT ON UPDATE CASCADE, "bookingId" UUID NOT NULL REFERENCES "Booking"(id) ON DELETE RESTRICT ON UPDATE CASCADE, amount BIGINT NOT NULL CHECK(amount>0),
  UNIQUE("payoutId","bookingId")
);
CREATE INDEX "AgencyPayoutItem_bookingId_idx" ON "AgencyPayoutItem"("bookingId");
CREATE TABLE "AgencyFinancePolicy" (
  id TEXT PRIMARY KEY DEFAULT 'default', "holdDays" INTEGER NOT NULL CHECK("holdDays" BETWEEN 0 AND 90),
  "refundCommissionPolicy" TEXT NOT NULL CHECK("refundCommissionPolicy"='PROPORTIONAL'), "updatedBy" UUID NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "AgencyFinanceAudit" (
  id UUID PRIMARY KEY, "agencyId" UUID, "actorId" UUID NOT NULL, action TEXT NOT NULL, "entityId" TEXT NOT NULL, details JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AgencyFinanceAudit_agencyId_createdAt_idx" ON "AgencyFinanceAudit"("agencyId","createdAt");

-- Durable receipt discovery, even when the application dies after committing payment.
CREATE FUNCTION finance_enqueue_payment() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.purpose='BOOKING' AND NEW.status='PAID' THEN
    INSERT INTO "FinanceOutbox"("paymentId") VALUES(NEW.id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER finance_payment_outbox AFTER INSERT OR UPDATE ON "Payment" FOR EACH ROW EXECUTE FUNCTION finance_enqueue_payment();
-- Historical PAID is discovered, never marked MATCHED without gateway evidence.
INSERT INTO "FinanceOutbox"("paymentId") SELECT id FROM "Payment" WHERE purpose='BOOKING' AND status='PAID' ON CONFLICT DO NOTHING;

CREATE FUNCTION finance_no_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  RAISE EXCEPTION 'Posted financial evidence is append-only';
END $$;
CREATE TRIGGER finance_journal_immutable BEFORE UPDATE OR DELETE ON "AgencyTransaction" FOR EACH ROW EXECUTE FUNCTION finance_no_rewrite();
CREATE TRIGGER finance_entries_immutable BEFORE UPDATE OR DELETE ON "AgencyLedgerEntry" FOR EACH ROW EXECUTE FUNCTION finance_no_rewrite();
CREATE TRIGGER finance_evidence_immutable BEFORE UPDATE OR DELETE ON "AgencyGatewayObservation" FOR EACH ROW EXECUTE FUNCTION finance_no_rewrite();
CREATE TRIGGER finance_audit_immutable BEFORE UPDATE OR DELETE ON "AgencyFinanceAudit" FOR EACH ROW EXECUTE FUNCTION finance_no_rewrite();
CREATE FUNCTION finance_check_journal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE journal UUID; difference NUMERIC; cnt BIGINT;
BEGIN
  IF TG_TABLE_NAME='AgencyTransaction' THEN journal=NEW.id; ELSE journal=NEW."transactionId"; END IF;
  SELECT COALESCE(SUM(debit::numeric-credit::numeric),0), COUNT(*) INTO difference,cnt FROM "AgencyLedgerEntry" WHERE "transactionId"=journal;
  IF difference<>0 OR cnt<2 THEN RAISE EXCEPTION 'Unbalanced financial journal'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER finance_journal_balanced AFTER INSERT ON "AgencyTransaction" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_check_journal();
CREATE CONSTRAINT TRIGGER finance_entries_balanced AFTER INSERT ON "AgencyLedgerEntry" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_check_journal();

-- A balanced extra pair cannot be appended to a journal after it has committed.
CREATE FUNCTION finance_entry_same_transaction() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE creator BIGINT;
BEGIN
  SELECT xmin::text::bigint INTO creator FROM "AgencyTransaction" WHERE id=NEW."transactionId";
  IF creator IS DISTINCT FROM (txid_current() % 4294967296) THEN RAISE EXCEPTION 'Cannot append to a posted journal'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER finance_entry_new_journal BEFORE INSERT ON "AgencyLedgerEntry" FOR EACH ROW EXECUTE FUNCTION finance_entry_same_transaction();

-- Source mutations take the same organization lock as payout eligibility checks.
-- This also covers older application workers sharing the database.
CREATE FUNCTION finance_lock_source_agency() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM id FROM "AgencyProfile" WHERE id=NEW."agencyId" FOR UPDATE;
  RETURN NEW;
END $$;
CREATE TRIGGER finance_booking_source_lock BEFORE INSERT OR UPDATE ON "Booking" FOR EACH ROW EXECUTE FUNCTION finance_lock_source_agency();
CREATE TRIGGER finance_complaint_source_lock BEFORE INSERT OR UPDATE ON "ComplaintTicket" FOR EACH ROW EXECUTE FUNCTION finance_lock_source_agency();
CREATE FUNCTION finance_lock_payment_agency() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.purpose='BOOKING' THEN
    PERFORM a.id FROM "AgencyProfile" a JOIN "Booking" b ON b."agencyId"=a.id WHERE b.id=NEW."referenceId" FOR UPDATE OF a;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER finance_payment_source_lock BEFORE INSERT OR UPDATE ON "Payment" FOR EACH ROW EXECUTE FUNCTION finance_lock_payment_agency();
