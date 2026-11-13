-- CreateEnum
CREATE TYPE "TourVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "CustomTourStatus" AS ENUM ('SUBMITTED', 'NEGOTIATING', 'OFFERED', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PassengerType" AS ENUM ('ADULT', 'CHILD', 'INFANT');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CUSTOM_TOUR_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CUSTOM_TOUR_DECIDED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CUSTOM_TOUR_OFFERED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CUSTOM_TOUR_ACCEPTED';

-- AlterTable
ALTER TABLE "Tour" ADD COLUMN "visibility" "TourVisibility" NOT NULL DEFAULT 'PUBLIC';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "customTourRequestId" UUID;

-- CreateTable
CREATE TABLE "CustomTourRequest" (
    "id" UUID NOT NULL,
    "travelerId" UUID NOT NULL,
    "agencyId" UUID NOT NULL,
    "sourceTourId" UUID NOT NULL,
    "conversationId" UUID,
    "privateTourId" UUID,
    "status" "CustomTourStatus" NOT NULL DEFAULT 'SUBMITTED',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "participants" INTEGER NOT NULL,
    "guestCounts" JSONB,
    "notes" TEXT,
    "offerSnapshot" JSONB,
    "checkoutDraft" JSONB,
    "checkoutRevision" INTEGER NOT NULL DEFAULT 1,
    "clientRequestId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomTourRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingPassenger" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "guestType" "PassengerType" NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "idCard" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingPassenger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomTourRequest_privateTourId_key" ON "CustomTourRequest"("privateTourId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomTourRequest_travelerId_clientRequestId_key" ON "CustomTourRequest"("travelerId", "clientRequestId");

-- CreateIndex
CREATE INDEX "CustomTourRequest_travelerId_createdAt_id_idx" ON "CustomTourRequest"("travelerId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "CustomTourRequest_agencyId_status_createdAt_id_idx" ON "CustomTourRequest"("agencyId", "status", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "CustomTourRequest_conversationId_idx" ON "CustomTourRequest"("conversationId");

-- CreateIndex
CREATE INDEX "Booking_customTourRequestId_createdAt_idx" ON "Booking"("customTourRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "BookingPassenger_bookingId_idx" ON "BookingPassenger"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingPassenger_bookingId_idCard_key" ON "BookingPassenger"("bookingId", "idCard");

-- AddForeignKey
ALTER TABLE "BookingPassenger" ADD CONSTRAINT "BookingPassenger_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One request has at most one live booking (PENDING/CONFIRMED); cancelled/expired history stays.
CREATE UNIQUE INDEX "Booking_customTourRequestId_active_key"
    ON "Booking"("customTourRequestId")
    WHERE "customTourRequestId" IS NOT NULL AND "status" IN ('PENDING', 'CONFIRMED');
