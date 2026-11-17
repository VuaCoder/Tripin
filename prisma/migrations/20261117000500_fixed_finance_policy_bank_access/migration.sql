-- Old OWNER roles predate the separate bank-management capability.
WITH changed AS (
 UPDATE "AgencyRole" SET permissions=array_append(permissions,'agency:finance-bank-manage')
 WHERE "systemRole"='OWNER' AND NOT ('agency:finance-bank-manage'=ANY(permissions)) RETURNING "agencyId"
)
UPDATE "AgencyProfile" SET "permissionVersion"="permissionVersion"+1 WHERE id IN (SELECT "agencyId" FROM changed);

-- System policy and automatic audit entries have no human author.
ALTER TABLE "AgencySettlementPolicyVersion" ALTER COLUMN "actorId" DROP NOT NULL;
ALTER TABLE "AgencyFinanceAudit" ALTER COLUMN "actorId" DROP NOT NULL;
ALTER TABLE "AgencyFinancePolicy" ALTER COLUMN "updatedBy" DROP NOT NULL;
INSERT INTO "AgencySettlementPolicyVersion"(id,"effectiveAt",snapshot,"actorId",reason)
VALUES ('e1000000-0000-4000-8000-000000000007',CURRENT_TIMESTAMP,
 '{"holdDays":7,"autoSettlement":true,"minWithdrawal":"100000","maxWithdrawal":"500000000","dailyWithdrawalLimit":"1000000000","processingHours":48,"includeExistingReports":true}',
 NULL,'Chính sách cố định của hệ thống: giữ tiền 7 ngày');
INSERT INTO "AgencyFinancePolicy"(id,"holdDays","refundCommissionPolicy","updatedBy","updatedAt","autoSettlement","minWithdrawal","maxWithdrawal","dailyWithdrawalLimit","processingHours")
VALUES ('default',7,'PROPORTIONAL',NULL,CURRENT_TIMESTAMP,true,100000,500000000,1000000000,48)
ON CONFLICT(id) DO UPDATE SET "holdDays"=7,"autoSettlement"=true,"minWithdrawal"=100000,"maxWithdrawal"=500000000,"dailyWithdrawalLimit"=1000000000,"processingHours"=48,"updatedBy"=NULL,"updatedAt"=CURRENT_TIMESTAMP;
INSERT INTO "AgencyFinanceAudit"(id,"agencyId","actorId",action,"entityId",details)
VALUES ('e1000000-0000-4000-8000-000000000008',NULL,NULL,'FINANCE_FIXED_POLICY_ACTIVATED','default','{"holdDays":7,"automatic":true}');
