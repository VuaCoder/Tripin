BEGIN;
ALTER TABLE "AgencyProfile" ADD COLUMN "permissionVersion" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "AgencyRole" (
  id UUID NOT NULL DEFAULT gen_random_uuid(), "agencyId" UUID NOT NULL, name TEXT NOT NULL,
  "systemRole" "AgencyMemberRole", permissions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgencyRole_pkey" PRIMARY KEY (id),
  CONSTRAINT "AgencyRole_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "AgencyProfile"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "AgencyRole_name_check" CHECK (length(trim(name)) BETWEEN 1 AND 80)
);
CREATE UNIQUE INDEX "AgencyRole_agencyId_id_key" ON "AgencyRole"("agencyId",id);
CREATE UNIQUE INDEX "AgencyRole_agencyId_name_key" ON "AgencyRole"("agencyId",name);
CREATE UNIQUE INDEX "AgencyRole_agencyId_systemRole_key" ON "AgencyRole"("agencyId","systemRole");
ALTER TABLE "AgencyMember" ADD COLUMN "roleId" UUID;
ALTER TABLE "AgencyInvitation" ADD COLUMN "roleId" UUID;
CREATE INDEX "AgencyMember_agencyId_roleId_idx" ON "AgencyMember"("agencyId","roleId");
CREATE INDEX "AgencyInvitation_agencyId_roleId_idx" ON "AgencyInvitation"("agencyId","roleId");
CREATE UNIQUE INDEX "AgencyMember_agencyId_id_key" ON "AgencyMember"("agencyId",id);
ALTER TABLE "AgencyMember" ADD CONSTRAINT "AgencyMember_agencyId_roleId_fkey"
  FOREIGN KEY ("agencyId","roleId") REFERENCES "AgencyRole"("agencyId",id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "AgencyInvitation" ADD CONSTRAINT "AgencyInvitation_agencyId_roleId_fkey"
  FOREIGN KEY ("agencyId","roleId") REFERENCES "AgencyRole"("agencyId",id) ON DELETE RESTRICT ON UPDATE NO ACTION;
CREATE TABLE "AgencyMemberPermissionOverride" (
  "agencyId" UUID NOT NULL, "memberId" UUID NOT NULL, permission TEXT NOT NULL, effect TEXT NOT NULL,
  CONSTRAINT "AgencyMemberPermissionOverride_pkey" PRIMARY KEY ("memberId",permission),
  CONSTRAINT "AgencyMemberPermissionOverride_effect_check" CHECK (effect IN ('ALLOW','DENY')),
  CONSTRAINT "AgencyMemberPermissionOverride_agencyId_memberId_fkey" FOREIGN KEY ("agencyId","memberId")
    REFERENCES "AgencyMember"("agencyId",id) ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "Tour_agencyId_id_key" ON "Tour"("agencyId",id);
CREATE TABLE "AgencyMemberTourScope" (
  "agencyId" UUID NOT NULL, "memberId" UUID NOT NULL, "tourId" UUID NOT NULL,
  "allowedFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  CONSTRAINT "AgencyMemberTourScope_pkey" PRIMARY KEY ("memberId","tourId"),
  CONSTRAINT "AgencyMemberTourScope_fields_check" CHECK ("allowedFields" <@ ARRAY['title','summary','description']::TEXT[]),
  CONSTRAINT "AgencyMemberTourScope_agencyId_memberId_fkey" FOREIGN KEY ("agencyId","memberId") REFERENCES "AgencyMember"("agencyId",id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "AgencyMemberTourScope_agencyId_tourId_fkey" FOREIGN KEY ("agencyId","tourId") REFERENCES "Tour"("agencyId",id) ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE INDEX "AgencyMemberTourScope_agencyId_tourId_idx" ON "AgencyMemberTourScope"("agencyId","tourId");

CREATE FUNCTION agency_seed_access_roles(target UUID) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  tour TEXT[] := ARRAY['tour:create','tour:update-own','tour:delete-own','tour:import','tour:set-availability','tour:configure-itinerary','tour:assign-guide'];
  ops TEXT[] := ARRAY['agency:bookings-view','agency:export-customers','complaint:respond','review:dispute'];
BEGIN
  INSERT INTO "AgencyRole"("agencyId",name,"systemRole",permissions) VALUES
    (target,'Agency Owner','OWNER',ARRAY['agency:context-view','agency:tour-view','agency:tour-content-update','agency:booking-monitor'] || tour || ops || ARRAY['promotion:agency-manage','premium:contribute','agency:dashboard','agency:finance-view','agency:team-view','agency:team-invite','agency:team-manage','agency:permissions-manage','agency:finance-manage']),
    (target,'Agency Manager','MANAGER',ARRAY['agency:context-view','agency:tour-view','agency:tour-content-update','agency:booking-monitor','tour:create','tour:update-own','tour:set-availability','tour:configure-itinerary','tour:assign-guide'] || ops || ARRAY['promotion:agency-manage','agency:dashboard']),
    (target,'Agency Staff','STAFF',ARRAY['agency:context-view','agency:tour-view','agency:tour-content-update','agency:booking-monitor']),
    (target,'Agency Accountant','ACCOUNTANT',ARRAY['agency:context-view','agency:bookings-view','agency:dashboard','agency:finance-view'])
  ON CONFLICT ("agencyId","systemRole") DO NOTHING;
END $$;
SELECT agency_seed_access_roles(id) FROM "AgencyProfile";
UPDATE "AgencyMember" m SET "roleId"=r.id FROM "AgencyRole" r WHERE r."agencyId"=m."agencyId" AND r."systemRole"=m.role;
UPDATE "AgencyInvitation" i SET "roleId"=r.id FROM "AgencyRole" r WHERE r."agencyId"=i."agencyId" AND r."systemRole"=i.role;

-- New onboarding remains compatible, including nested User -> AgencyProfile writes.
CREATE FUNCTION agency_access_roles_onboarding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM agency_seed_access_roles(NEW.id); RETURN NEW; END $$;
CREATE TRIGGER agency_access_roles_after_insert AFTER INSERT ON "AgencyProfile"
  FOR EACH ROW EXECUTE FUNCTION agency_access_roles_onboarding();
CREATE FUNCTION agency_assign_default_role() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."roleId" IS NULL OR (TG_OP='UPDATE' AND NEW.role<>OLD.role AND NEW."roleId" IS NOT DISTINCT FROM OLD."roleId") THEN
    SELECT id INTO NEW."roleId" FROM "AgencyRole" WHERE "agencyId"=NEW."agencyId" AND "systemRole"=NEW.role;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER agency_member_default_role BEFORE INSERT OR UPDATE ON "AgencyMember"
  FOR EACH ROW EXECUTE FUNCTION agency_assign_default_role();
CREATE TRIGGER agency_invitation_default_role BEFORE INSERT OR UPDATE ON "AgencyInvitation"
  FOR EACH ROW EXECUTE FUNCTION agency_assign_default_role();
COMMIT;
