BEGIN;

-- Match newly seeded system roles with the application policy.
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

-- Existing system roles gain the same capabilities. Custom roles are untouched.
UPDATE "AgencyRole"
SET permissions = permissions || ARRAY['custom-tour:view','custom-tour:respond']::TEXT[]
WHERE "systemRole" IN ('OWNER','MANAGER','STAFF')
  AND NOT (permissions @> ARRAY['custom-tour:view','custom-tour:respond']::TEXT[]);

COMMIT;
