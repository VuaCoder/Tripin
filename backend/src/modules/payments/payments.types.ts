import { PAYMENT_STATUS, type PaymentPurpose, type PaymentStatus } from '@travel-platform/constants';
import type { TransitionMap } from '../../utils/state-machine';

const S = PAYMENT_STATUS;
/**
 * PAID is terminal: money received is never "un-received" by this module.
 * A verified webhook may also move EXPIRED / CANCELLED / FAILED -> PAID (the customer paid after we gave up);
 * the booking/subscription side then decides what to do (e.g. flag a refund).
 */
export const PAYMENT_TRANSITIONS: TransitionMap<PaymentStatus> = {
  [S.PENDING]: [S.PAID, S.CANCELLED, S.EXPIRED, S.FAILED],
  [S.EXPIRED]: [S.PAID],
  [S.CANCELLED]: [S.PAID],
  [S.FAILED]: [S.PAID],
};

export const PAYMENT_POLICY = {
  /** PayOS descriptions are limited; the booking code / short text is used. */
  MAX_DESCRIPTION_LENGTH: 25,
  MAINTENANCE_BATCH: 100,
  /** A payment is reconciled with the gateway at most this often per node, however often the client polls `GET /payments/:id`. */
  SYNC_MIN_INTERVAL_MS: 5_000,
  SYNC_TRACKED_PAYMENTS: 1_000,
  /** Checkout waits for a parallel request that is creating the same link: 8 x 60 ms at most. */
  CHECKOUT_MAX_ROUNDS: 8,
  CHECKOUT_RETRY_DELAY_MS: 60,
} as const;

export interface PaymentDto {
  id: string;
  purpose: PaymentPurpose;
  referenceId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  checkoutUrl?: string;
  expiresAt: string;
  paidAt?: string;
  createdAt: string;
}

export interface CheckoutDto {
  paymentId: string;
  checkoutUrl: string;
  amount: number;
  expiresAt: string;
}

/** Generic checkout request used by modules other than bookings (e.g. subscriptions). */
export interface CreateCheckoutInput {
  purpose: PaymentPurpose;
  userId: string;
  referenceId: string;
  amount: number;
  description: string;
  expiresAt: Date;
}

/** Immutable facts handed to `paymentEvents` handlers after a payment became PAID. */
export interface PaymentFacts {
  id: string;
  purpose: PaymentPurpose;
  userId: string;
  referenceId: string;
  amount: number;
}
