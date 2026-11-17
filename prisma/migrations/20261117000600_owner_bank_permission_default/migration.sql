-- Organization roles are also created by a database trigger with historical defaults.
-- Keep bank input available for newly created OWNER roles, not just existing ones.
CREATE OR REPLACE FUNCTION finance_owner_withdraw_default() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW."systemRole"='OWNER' THEN
  IF NOT ('agency:finance-withdraw'=ANY(NEW.permissions)) THEN NEW.permissions=array_append(NEW.permissions,'agency:finance-withdraw'); END IF;
  IF NOT ('agency:finance-bank-manage'=ANY(NEW.permissions)) THEN NEW.permissions=array_append(NEW.permissions,'agency:finance-bank-manage'); END IF;
 END IF;
 RETURN NEW;
END $$;
