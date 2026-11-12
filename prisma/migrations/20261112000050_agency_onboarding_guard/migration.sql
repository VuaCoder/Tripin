BEGIN;
-- Fail closed across the Foundation -> Legacy Onboarding commit boundary.
-- CREATE TRIGGER waits for in-flight AgencyProfile writers before committing.
-- If any later migration fails, onboarding stays quarantined until recovery.
CREATE FUNCTION agency_onboarding_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Agency onboarding temporarily unavailable during foundation migration'
    USING ERRCODE = '55000';
END $$;
CREATE TRIGGER agency_onboarding_guard_before_insert BEFORE INSERT ON "AgencyProfile"
  FOR EACH ROW EXECUTE FUNCTION agency_onboarding_guard();
COMMIT;
