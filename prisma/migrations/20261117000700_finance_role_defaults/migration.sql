-- Keep database-seeded roles aligned with the finance capabilities in application
-- defaults. Do not expand intentionally edited roles during the existing-row repair.
BEGIN;
CREATE OR REPLACE FUNCTION finance_owner_withdraw_default() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE grant_name TEXT;
BEGIN
  IF NEW."systemRole" IN ('OWNER','ACCOUNTANT') THEN
    FOREACH grant_name IN ARRAY ARRAY['agency:finance-export','agency:finance-reconcile','agency:finance-refund-record'] LOOP
      IF NOT (grant_name=ANY(NEW.permissions)) THEN NEW.permissions=array_append(NEW.permissions,grant_name); END IF;
    END LOOP;
  END IF;
  IF NEW."systemRole"='OWNER' THEN
    FOREACH grant_name IN ARRAY ARRAY['agency:finance-withdraw','agency:finance-bank-manage'] LOOP
      IF NOT (grant_name=ANY(NEW.permissions)) THEN NEW.permissions=array_append(NEW.permissions,grant_name); END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

WITH changed AS (
  UPDATE "AgencyRole" SET
    permissions=permissions || ARRAY(
      SELECT grant_name FROM unnest(ARRAY['agency:finance-export','agency:finance-reconcile','agency:finance-refund-record']) AS grant_name
      WHERE NOT (grant_name=ANY(permissions))
    ), "updatedAt"=CURRENT_TIMESTAMP
  WHERE "systemRole" IN ('OWNER','ACCOUNTANT') AND "updatedAt"="createdAt"
    AND 'agency:finance-view'=ANY(permissions)
    AND NOT (permissions @> ARRAY['agency:finance-export','agency:finance-reconcile','agency:finance-refund-record'])
  RETURNING "agencyId"
)
UPDATE "AgencyProfile" SET "permissionVersion"="permissionVersion"+1 WHERE id IN (SELECT "agencyId" FROM changed);
COMMIT;
