ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TOUR_COMPLETION_DUE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TOUR_COMPLETION_OVERDUE';
ALTER TABLE "Booking" ADD COLUMN "attendedParticipants" INTEGER;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_attendance_check" CHECK ("attendedParticipants" IS NULL OR ("attendedParticipants" >= 0 AND "attendedParticipants" <= "participants"));

CREATE TABLE "TourCompletion" (
  "id" UUID NOT NULL, "departureId" UUID NOT NULL, "agencyId" UUID NOT NULL, "tourId" UUID NOT NULL,
  "scheduledEndAt" TIMESTAMP(3) NOT NULL, "completedAt" TIMESTAMP(3), "revision" INTEGER NOT NULL DEFAULT 0,
  "snapshot" JSONB NOT NULL, "remindedAt" TIMESTAMP(3), "escalatedAt" TIMESTAMP(3),
  CONSTRAINT "TourCompletion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TourCompletion_departureId_fkey" FOREIGN KEY ("departureId") REFERENCES "TourDeparture"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TourCompletion_departureId_key" ON "TourCompletion"("departureId");
CREATE INDEX "TourCompletion_agencyId_completedAt_scheduledEndAt_idx" ON "TourCompletion"("agencyId", "completedAt", "scheduledEndAt");
CREATE TABLE "TourCompletionReport" (
  "id" UUID NOT NULL, "completionId" UUID NOT NULL, "revision" INTEGER NOT NULL, "actorId" UUID NOT NULL,
  "submitted" BOOLEAN NOT NULL DEFAULT false, "payload" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TourCompletionReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TourCompletionReport_completionId_fkey" FOREIGN KEY ("completionId") REFERENCES "TourCompletion"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TourCompletionReport_completionId_revision_key" ON "TourCompletionReport"("completionId", "revision");
CREATE TABLE "TourCompletionDelivery" (
  "id" UUID NOT NULL, "completionId" UUID NOT NULL, "bookingId" UUID NOT NULL,
  "guideId" UUID, "guideFee" BIGINT, "deliveredAt" TIMESTAMP(3), "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TourCompletionDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TourCompletionDelivery_completionId_fkey" FOREIGN KEY ("completionId") REFERENCES "TourCompletion"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TourCompletionDelivery_bookingId_key" ON "TourCompletionDelivery"("bookingId");
CREATE INDEX "TourCompletionDelivery_deliveredAt_nextAttemptAt_idx" ON "TourCompletionDelivery"("deliveredAt", "nextAttemptAt");
