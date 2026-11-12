BEGIN;
-- Compatibility for existing nested User -> AgencyProfile onboarding. These
-- triggers affect NEW profiles only; independent agencies omit legacy userId.
CREATE FUNCTION agency_legacy_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."userId" IS NOT NULL THEN NEW.id := NEW."userId"; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER agency_legacy_identity_before_insert BEFORE INSERT ON "AgencyProfile"
  FOR EACH ROW EXECUTE FUNCTION agency_legacy_identity();
CREATE FUNCTION agency_legacy_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."userId" IS NOT NULL THEN
    INSERT INTO "AgencyMember" ("agencyId", "userId", role) VALUES (NEW.id, NEW."userId", 'OWNER');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER agency_legacy_owner_after_insert AFTER INSERT ON "AgencyProfile"
  FOR EACH ROW EXECUTE FUNCTION agency_legacy_owner();
COMMIT;
