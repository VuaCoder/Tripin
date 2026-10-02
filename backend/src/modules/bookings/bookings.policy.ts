import { BOOKING_STATUS, type BookingStatus } from '@travel-platform/constants';
import type { TransitionMap } from '../../utils/state-machine';

/** Tunable booking rules (no magic numbers in the service). */
export const BOOKING_POLICY = {
  /** How long a PENDING booking holds its seats while waiting for payment. Keep in sync with the payment link expiry. */
  PENDING_PAYMENT_MINUTES: 30,
  MAX_PARTICIPANTS: 50,
  /** Smallest amount (VND) a booking may ask the traveler to pay: a payment of 0 cannot exist. The gateway may impose a higher floor - verify in the PayOS sandbox (DECISIONS D-40/D-74). */
  MIN_PAYABLE_AMOUNT: 1,
  /** Documents processed per maintenance run (expiry / completion). */
  MAINTENANCE_BATCH: 100,
  CODE_PREFIX: 'TRP',
  CODE_LENGTH: 8,
  /** No 0/O/1/I so codes are easy to read out loud. */
  CODE_ALPHABET: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
  CODE_MAX_ATTEMPTS: 5,
} as const;

const S = BOOKING_STATUS;
/**
 *  PENDING   -> CONFIRMED (verified payment) | CANCELLED (traveler, or payment window expired)
 *  CONFIRMED -> COMPLETED (after the tour ends, by the maintenance job) | CANCELLED (traveler, inside the cancellation window)
 * Refund money movement is out of scope (DECISIONS D-15): a paid booking that gets cancelled is flagged `refundRequired`.
 */
export const BOOKING_TRANSITIONS: TransitionMap<BookingStatus> = {
  [S.PENDING]: [S.CONFIRMED, S.CANCELLED],
  [S.CONFIRMED]: [S.COMPLETED, S.CANCELLED],
};
