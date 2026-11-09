-- AlterTable
ALTER TABLE "ComplaintFeedback" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ComplaintTicket" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ComplaintTicketMessage" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RefundLedger" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;
