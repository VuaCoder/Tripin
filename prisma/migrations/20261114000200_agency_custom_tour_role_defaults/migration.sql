BEGIN;

CREATE OR REPLACE FUNCTION agency_seed_access_roles(target UUID) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  tour TEXT[] := ARRAY['tour:create','tour:update-own','tour:delete-own','tour:import','tour:set-availability','tour:configure-itinerary','tour:assign-guide'];
  ops TEXT[] := ARRAY['agency:bookings-view','agency:export-customers','complaint:respond','review:dispute'];
  custom_tours TEXT[] := ARRAY['custom-tour:view','custom-tour:respond'];
BEGIN
  INSERT INTO "AgencyRole"("agencyId",name,"systemRole",permissions) VALUES
    (target,'Agency Owner','OWNER',ARRAY['agency:context-view','agency:tour-view','agency:tour-content-update','agency:booking-monitor'] || tour || ops || custom_tours || ARRAY['promotion:agency-manage','premium:contribute','agency:dashboard','agency:finance-view','agency:team-view','agency:team-invite','agency:team-manage','agency:permissions-manage','agency:finance-manage']),
    (target,'Agency Manager','MANAGER',ARRAY['agency:context-view','agency:tour-view','agency:tour-content-update','agency:booking-monitor','tour:create','tour:update-own','tour:set-availability','tour:configure-itinerary','tour:assign-guide'] || ops || custom_tours || ARRAY['promotion:agency-manage','agency:dashboard']),
    (target,'Agency Staff','STAFF',ARRAY['agency:context-view','agency:tour-view','agency:tour-content-update','agency:booking-monitor'] || custom_tours),
    (target,'Agency Accountant','ACCOUNTANT',ARRAY['agency:context-view','agency:bookings-view','agency:dashboard','agency:finance-view'])
  ON CONFLICT ("agencyId","systemRole") DO NOTHING;
END $$;

-- Repair only untouched legacy templates. Customized roles and member overrides
-- must never gain capabilities as a side effect of this migration.
DO $$
DECLARE
  base TEXT[] := ARRAY['agency:context-view','agency:tour-view','agency:tour-content-update','agency:booking-monitor'];
  ops TEXT[] := ARRAY['agency:bookings-view','agency:export-customers','complaint:respond','review:dispute'];
  tour TEXT[] := ARRAY['tour:create','tour:update-own','tour:delete-own','tour:import','tour:set-availability','tour:configure-itinerary','tour:assign-guide'];
  previous TEXT[];
  changed_agencies UUID[] := ARRAY[]::UUID[];
  r RECORD;
BEGIN
  FOR r IN SELECT id, "agencyId", "systemRole", permissions FROM "AgencyRole"
    WHERE "systemRole" IN ('OWNER','MANAGER','STAFF') AND "updatedAt" = "createdAt" LOOP
    previous := CASE r."systemRole"
      WHEN 'OWNER' THEN base || tour || ops || ARRAY['promotion:agency-manage','premium:contribute','agency:dashboard','agency:finance-view','agency:team-view','agency:team-invite','agency:team-manage','agency:permissions-manage','agency:finance-manage']
      WHEN 'MANAGER' THEN base || ARRAY['tour:create','tour:update-own','tour:set-availability','tour:configure-itinerary','tour:assign-guide'] || ops || ARRAY['promotion:agency-manage','agency:dashboard']
      ELSE base END;
    IF r.permissions @> previous AND r.permissions <@ (previous || ARRAY['chat:use']) THEN
      UPDATE "AgencyRole" SET permissions = permissions || ARRAY['custom-tour:view','custom-tour:respond'], "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = r.id AND permissions = r.permissions AND "updatedAt" = "createdAt";
      IF FOUND THEN changed_agencies := array_append(changed_agencies, r."agencyId"); END IF;
    END IF;
  END LOOP;
  UPDATE "AgencyProfile" SET "permissionVersion" = "permissionVersion" + 1 WHERE id = ANY(changed_agencies);
END $$;

COMMIT;
