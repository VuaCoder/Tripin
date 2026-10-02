export const PAYMENT_PURPOSE = {
  BOOKING: 'BOOKING',
  SUBSCRIPTION: 'SUBSCRIPTION',
} as const;
export type PaymentPurpose = (typeof PAYMENT_PURPOSE)[keyof typeof PAYMENT_PURPOSE];

export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  FAILED: 'FAILED',
} as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];
