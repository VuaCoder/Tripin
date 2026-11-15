BEGIN;

-- 20261114000200 (custom-tour defaults) reached production AFTER 20261114000300, so its copy of the seed
-- function — taken before chat:use existed — replaced the chat-aware one. Agencies created since then got
-- OWNER/MANAGER/STAFF templates without chat:use, and /agency/conversations answers "Bạn không có quyền…".
-- This function is the SQL twin of AGENCY_ROLE_PERMISSIONS in src/modules/agencies/agency.policy.ts; keep them equal.
CREATE OR REPLACE FUNCTION agency_seed_access_roles(target UUID) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  tour TEXT[] := ARRAY['tour:create','tour:update-own','tour:delete-own','tour:import','tour:set-availability','tour:configure-itinerary','tour:assign-guide'];
  ops TEXT[] := ARRAY['agency:bookings-view','agency:export-customers','complaint:respond','review:dispute'];
  custom_tour TEXT[] := ARRAY['custom-tour:view','custom-tour:respond'];
BEGIN
  INSERT INTO "AgencyRole"("agencyId",name,"systemRole",permissions) VALUES
    (target,'Agency Owner','OWNER',ARRAY['agency:context-view','chat:use','agency:tour-view','agency:tour-content-update','agency:booking-monitor'] || tour || ops || custom_tour || ARRAY['promotion:agency-manage','premium:contribute','agency:dashboard','agency:finance-view','agency:team-view','agency:team-invite','agency:team-manage','agency:permissions-manage','agency:finance-manage']),
    (target,'Agency Manager','MANAGER',ARRAY['agency:context-view','chat:use','agency:tour-view','agency:tour-content-update','agency:booking-monitor','tour:create','tour:update-own','tour:set-availability','tour:configure-itinerary','tour:assign-guide'] || ops || custom_tour || ARRAY['promotion:agency-manage','agency:dashboard']),
    (target,'Agency Staff','STAFF',ARRAY['agency:context-view','chat:use','agency:tour-view','agency:tour-content-update','agency:booking-monitor'] || custom_tour),
    (target,'Agency Accountant','ACCOUNTANT',ARRAY['agency:context-view','agency:bookings-view','agency:dashboard','agency:finance-view'])
  ON CONFLICT ("agencyId","systemRole") DO NOTHING;
END $$;

-- Existing agencies: append only the permission a system role lacks, preserving any other edits.
DO $$
DECLARE affected UUID[];
BEGIN
  WITH updated AS (
    UPDATE "AgencyRole"
    SET permissions = permissions || ARRAY['chat:use'],
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "systemRole" IN ('OWNER','MANAGER','STAFF')
      AND NOT permissions @> ARRAY['chat:use']
    RETURNING "agencyId"
  )
  SELECT array_agg(DISTINCT "agencyId") INTO affected FROM updated;

  IF affected IS NOT NULL THEN
    UPDATE "AgencyProfile" SET "permissionVersion" = "permissionVersion" + 1 WHERE id = ANY(affected);
  END IF;
END $$;

COMMIT;
