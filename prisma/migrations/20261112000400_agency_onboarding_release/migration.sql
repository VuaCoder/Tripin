BEGIN;
-- Release only after both compatibility triggers and OWNER backfill exist.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = '"AgencyProfile"'::regclass
      AND tgname = 'agency_legacy_identity_before_insert' AND tgenabled = 'O')
    OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = '"AgencyProfile"'::regclass
      AND tgname = 'agency_legacy_owner_after_insert' AND tgenabled = 'O') THEN
    RAISE EXCEPTION 'Legacy onboarding triggers are not ready';
  END IF;
  IF EXISTS (SELECT 1 FROM "AgencyProfile" a WHERE a."userId" IS NOT NULL
      AND (a.id <> a."userId" OR NOT EXISTS (SELECT 1 FROM "AgencyMember" m
        WHERE m."agencyId" = a.id AND m."userId" = a."userId" AND m.role = 'OWNER' AND m.status = 'ACTIVE'))) THEN
    RAISE EXCEPTION 'Legacy identity / OWNER preservation check failed';
  END IF;
END $$;
DROP TRIGGER agency_onboarding_guard_before_insert ON "AgencyProfile";
DROP FUNCTION agency_onboarding_guard();
COMMIT;
