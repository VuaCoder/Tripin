BEGIN;
-- Historical personal notifications remain unchanged. New agency notifications
-- carry an explicit organization scope so revocation also closes inbox access.
ALTER TABLE "Notification" ADD COLUMN "agencyId" UUID;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "AgencyProfile"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
CREATE INDEX "Notification_agencyId_userId_idx" ON "Notification"("agencyId", "userId");
COMMIT;
