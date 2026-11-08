import { prisma } from '../../config/database';
import { logger } from '../../utils/logger';
import { bookingsRepository } from '../bookings/bookings.repository';
import { toBookingFacts } from '../bookings/bookings.mapper';
import { eTicketsService } from './e-tickets.service';

/** Reconciles persisted paid bookings, independently of the in-process confirmation listener. */
export async function retryTicketFulfillment(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 3 * 60_000);
  const due = await prisma.$queryRaw<{ id: string }[]>`
    SELECT b."id" FROM "Booking" b
    WHERE b."isPaid" = true AND b."status" IN ('CONFIRMED', 'COMPLETED')
      AND COALESCE(b."confirmedAt", b."createdAt") <= ${cutoff}
      AND (b."fulfillmentNextAttemptAt" IS NULL OR b."fulfillmentNextAttemptAt" <= ${now})
      AND NOT EXISTS (SELECT 1 FROM "ETicket" t WHERE t."bookingId" = b."id")
    ORDER BY b."confirmedAt" ASC NULLS FIRST, b."id" LIMIT 100`;
  let repaired = 0;
  for (const { id } of due) {
    try {
      const booking = await bookingsRepository.findById(id);
      if (!booking?.isPaid || !['CONFIRMED', 'COMPLETED'].includes(booking.status)) continue;
      // The row lock and unique bookingId in create serialize multiple worker instances.
      await eTicketsService.issueForBooking(toBookingFacts(booking), true);
      repaired += 1;
    } catch (error) {
      // Never record provider payloads or traveler information in persisted retry metadata.
      await prisma.$executeRaw`
        UPDATE "Booking" SET "fulfillmentStatus" = 'FAILED',
          "fulfillmentAttempts" = "fulfillmentAttempts" + 1,
          "fulfillmentNextAttemptAt" = ${new Date(now.getTime() + 3 * 60_000)}
        WHERE "id" = ${id}::uuid AND "status" IN ('CONFIRMED', 'COMPLETED')
          AND NOT EXISTS (SELECT 1 FROM "ETicket" t WHERE t."bookingId" = ${id}::uuid)`;
      logger.warn('Ticket fulfillment will be retried', { bookingId: id, code: error instanceof Error ? error.name : 'UNKNOWN' });
    }
  }
  return repaired;
}
