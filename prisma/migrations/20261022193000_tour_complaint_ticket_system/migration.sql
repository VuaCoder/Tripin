-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COMPLAINT_MESSAGE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COMPLAINT_RESOLVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COMPLAINT_ESCALATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COMPLAINT_FEEDBACK_REQUESTED';

-- CreateEnum
CREATE TYPE "ComplaintTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'ESCALATED');
CREATE TYPE "ComplaintTicketPriority" AS ENUM ('NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "ComplaintTicketCategory" AS ENUM ('ITINERARY', 'TRANSPORT', 'ACCOMMODATION_DINING', 'GUIDE_SERVICE', 'BILLING_REFUND', 'SAFETY_URGENT', 'OTHER');

-- CreateTable
CREATE TABLE "ComplaintTicket" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticketCode" TEXT NOT NULL,
    "travelerId" UUID NOT NULL,
    "agencyId" UUID NOT NULL,
    "tourId" UUID NOT NULL,
    "bookingId" UUID,
    "category" "ComplaintTicketCategory" NOT NULL,
    "subCategory" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ComplaintTicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "ComplaintTicketPriority" NOT NULL DEFAULT 'NORMAL',
    "solutionSummary" TEXT,
    "moderatorDecision" TEXT,
    "firstResponseAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplaintTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplaintTicketMessage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticketId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "senderRole" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintTicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplaintFeedback" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticketId" UUID NOT NULL,
    "agencyId" UUID NOT NULL,
    "travelerId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "speedScore" INTEGER NOT NULL DEFAULT 5,
    "attitudeScore" INTEGER NOT NULL DEFAULT 5,
    "satisfactionScore" INTEGER NOT NULL DEFAULT 5,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComplaintTicket_ticketCode_key" ON "ComplaintTicket"("ticketCode");
CREATE INDEX "ComplaintTicket_travelerId_createdAt_idx" ON "ComplaintTicket"("travelerId", "createdAt" DESC);
CREATE INDEX "ComplaintTicket_agencyId_status_createdAt_idx" ON "ComplaintTicket"("agencyId", "status", "createdAt" DESC);
CREATE INDEX "ComplaintTicket_status_createdAt_idx" ON "ComplaintTicket"("status", "createdAt" DESC);
CREATE INDEX "ComplaintTicket_tourId_createdAt_idx" ON "ComplaintTicket"("tourId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ComplaintTicketMessage_ticketId_createdAt_idx" ON "ComplaintTicketMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ComplaintFeedback_ticketId_key" ON "ComplaintFeedback"("ticketId");
CREATE INDEX "ComplaintFeedback_agencyId_createdAt_idx" ON "ComplaintFeedback"("agencyId", "createdAt" DESC);
CREATE INDEX "ComplaintFeedback_travelerId_createdAt_idx" ON "ComplaintFeedback"("travelerId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "ComplaintTicketMessage" ADD CONSTRAINT "ComplaintTicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ComplaintTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintFeedback" ADD CONSTRAINT "ComplaintFeedback_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ComplaintTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
