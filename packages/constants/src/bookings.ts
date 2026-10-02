export const BOOKING_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

/** Why a booking was cancelled (stored on the booking). */
export const BOOKING_CANCEL_REASON = {
  TRAVELER_REQUEST: 'TRAVELER_REQUEST',
  PAYMENT_EXPIRED: 'PAYMENT_EXPIRED',
} as const;
export type BookingCancelReason = (typeof BOOKING_CANCEL_REASON)[keyof typeof BOOKING_CANCEL_REASON];
