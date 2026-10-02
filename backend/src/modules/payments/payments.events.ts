import type { PaymentPurpose } from '@travel-platform/constants';
import type { PaymentFacts } from './payments.types';

export type PaidHandler = (payment: PaymentFacts) => Promise<void>;

/**
 * Purposes other than BOOKING register how a verified payment is fulfilled, e.g. `subscriptions` calls
 * `paymentEvents.onPaid('SUBSCRIPTION', activateSubscription)`. Exactly one handler per purpose.
 *
 * Handlers MUST be idempotent: a webhook can be delivered several times and a failed fulfilment is retried on the next
 * delivery. A handler that throws leaves the payment PAID but not "fulfilled", so the retry runs it again.
 */
class PaymentEvents {
  private readonly handlers = new Map<PaymentPurpose, PaidHandler>();

  onPaid(purpose: PaymentPurpose, handler: PaidHandler): void {
    this.handlers.set(purpose, handler);
  }

  handlerFor(purpose: PaymentPurpose): PaidHandler | undefined {
    return this.handlers.get(purpose);
  }
}

export const paymentEvents = new PaymentEvents();
