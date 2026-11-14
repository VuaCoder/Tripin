BEGIN;

-- A conversation is either traveler <-> guide (guideId set) or traveler <-> agency (agencyId set).
ALTER TABLE "Conversation" ADD COLUMN "agencyId" UUID;
ALTER TABLE "Conversation" ALTER COLUMN "guideId" DROP NOT NULL;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "AgencyProfile"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_participant_check"
  CHECK (("agencyId" IS NULL) <> ("guideId" IS NULL));

-- One thread per pair, but only within the same kind. Prisma cannot express these partial indexes.
DROP INDEX "Conversation_travelerId_guideId_key";
CREATE UNIQUE INDEX "Conversation_traveler_guide_key"
  ON "Conversation"("travelerId", "guideId") WHERE "agencyId" IS NULL;
CREATE UNIQUE INDEX "Conversation_traveler_agency_key"
  ON "Conversation"("travelerId", "agencyId") WHERE "agencyId" IS NOT NULL;
CREATE INDEX "Conversation_agencyId_lastActivityAt_id_idx"
  ON "Conversation"("agencyId", "lastActivityAt" DESC, "id" DESC);

-- Existing owner threads become the agency's inbox. If the owner belongs to several agencies (or another member already
-- has a thread with the same traveler), keep one agency thread and leave the rest as personal threads.
WITH mapped AS (
  SELECT DISTINCT ON (c."travelerId", am."agencyId")
         c.id AS conversation_id, am."agencyId"
  FROM "Conversation" c
  JOIN "User" u ON u.id = c."guideId" AND u.role = 'AGENCY'
  JOIN "AgencyMember" am ON am."userId" = c."guideId" AND am.status = 'ACTIVE'
  WHERE c."agencyId" IS NULL
  ORDER BY c."travelerId", am."agencyId", (am.role = 'OWNER') DESC, c."lastActivityAt" DESC
), chosen AS (
  SELECT DISTINCT ON (conversation_id) conversation_id, "agencyId"
  FROM mapped
  ORDER BY conversation_id, "agencyId"
)
UPDATE "Conversation" c
SET "agencyId" = chosen."agencyId", "guideId" = NULL
FROM chosen
WHERE c.id = chosen.conversation_id;

-- Customer chat belongs to the agency roles that face customers; ACCOUNTANT stays out.
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
