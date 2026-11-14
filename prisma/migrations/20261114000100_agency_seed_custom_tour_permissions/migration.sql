BEGIN;

-- The role templates were seeded before `custom-tour:*` was added to AGENCY_ROLE_PERMISSIONS,
-- so every seeded OWNER/MANAGER/STAFF role was missing the two permissions the policy grants.
CREATE OR REPLACE FUNCTION agency_seed_access_roles(target UUID) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  tour TEXT[] := ARRAY['tour:create','tour:update-own','tour:delete-own','tour:import','tour:set-availability','tour:configure-itinerary','tour:assign-guide'];
  ops TEXT[] := ARRAY['agency:bookings-view','agency:export-customers','complaint:respond','review:dispute'];
  custom_tour TEXT[] := ARRAY['custom-tour:view','custom-tour:respond'];
BEGIN
  INSERT INTO "AgencyRole"("agencyId",name,"systemRole",permissions) VALUES
    (target,'Agency Owner','OWNER',ARRAY['agency:context-view','agency:tour-view','agency:tour-content-update','agency:booking-monitor'] || tour || ops || custom_tour || ARRAY['promotion:agency-manage','premium:contribute','agency:dashboard','agency:finance-view','agency:team-view','agency:team-invite','agency:team-manage','agency:permissions-manage','agency:finance-manage']),
    (target,'Agency Manager','MANAGER',ARRAY['agency:context-view','agency:tour-view','agency:tour-content-update','agency:booking-monitor','tour:create','tour:update-own','tour:set-availability','tour:configure-itinerary','tour:assign-guide'] || ops || custom_tour || ARRAY['promotion:agency-manage','agency:dashboard']),
    (target,'Agency Staff','STAFF',ARRAY['agency:context-view','agency:tour-view','agency:tour-content-update','agency:booking-monitor'] || custom_tour),
    (target,'Agency Accountant','ACCOUNTANT',ARRAY['agency:context-view','agency:bookings-view','agency:dashboard','agency:finance-view'])
  ON CONFLICT ("agencyId","systemRole") DO NOTHING;
END $$;

-- Existing agencies: append only the permissions a system role lacks, preserving any other edits.
DO $$
DECLARE affected UUID[];
BEGIN
  WITH updated AS (
    UPDATE "AgencyRole"
    SET permissions = permissions || ARRAY(
          SELECT x FROM unnest(ARRAY['custom-tour:view','custom-tour:respond']) AS x
          WHERE x <> ALL(permissions)
        ),
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "systemRole" IN ('OWNER','MANAGER','STAFF')
      AND NOT permissions @> ARRAY['custom-tour:view','custom-tour:respond']
    RETURNING "agencyId"
  )
  SELECT array_agg(DISTINCT "agencyId") INTO affected FROM updated;

  IF affected IS NOT NULL THEN
    UPDATE "AgencyProfile" SET "permissionVersion" = "permissionVersion" + 1 WHERE id = ANY(affected);
  END IF;
END $$;

COMMIT;
