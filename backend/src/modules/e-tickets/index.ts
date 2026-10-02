// Public surface of e-tickets.
import { bookingEvents } from '../bookings';
import { eTicketsService } from './e-tickets.service';

export { eTicketsRouter } from './e-tickets.routes';
export { eTicketsService, ETicketsService } from './e-tickets.service';
export { ETICKET_STATUS, type ETicketDto } from './e-tickets.types';

/**
 * Wires the ticket lifecycle to the booking lifecycle (no import from bookings back to here, so no cycle):
 * CONFIRMED -> issue, CANCELLED -> invalidate, COMPLETED -> mark used.
 * Runs once at start-up when `routes/index.ts` imports this module.
 */
bookingEvents.onConfirmed(async (booking) => {
  await eTicketsService.issueForBooking(booking);
});
bookingEvents.onCancelled((booking) => eTicketsService.cancelForBooking(booking.id));
bookingEvents.onCompleted((booking) => eTicketsService.markUsedForBooking(booking.id));
