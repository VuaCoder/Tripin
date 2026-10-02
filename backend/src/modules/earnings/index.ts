// Public surface of earnings.
import { bookingEvents } from '../bookings';
import { earningsService } from './earnings.service';

export { earningsRouter } from './earnings.routes';
export { earningsService, EarningsService } from './earnings.service';
export type { EarningDto, EarningsSummaryDto } from './earnings.types';

/** A COMPLETED booking earns the guide their fee (idempotent). Registered once when `routes/index.ts` imports this module. */
bookingEvents.onCompleted(async (booking) => {
  await earningsService.recordForBooking(booking);
});
