import { randomInt } from 'node:crypto';
import { PAYMENT_PURPOSE, PAYMENT_STATUS, type PaymentPurpose, type PaymentStatus } from '@travel-platform/constants';
import { env } from '../../config/env';
import { AppError } from '../../utils/app-error';
import { logger } from '../../utils/logger';
import { bookingsService, type BookingsService } from '../bookings';
import { NOTIFICATION_TYPE, notificationsService, type NotificationsService } from '../notifications';
import { toCheckoutDto, toPaymentDto, toPaymentFacts } from './payments.mapper';
import type { PaymentDocument } from './payments.model';
import { paymentEvents } from './payments.events';
import { paymentsRepository, type PaymentsRepository } from './payments.repository';
import {
  PAYMENT_POLICY,
  PAYMENT_TRANSITIONS,
  type CheckoutDto,
  type CreateCheckoutInput,
  type PaymentDto,
} from './payments.types';
import type { PaymentProvider } from './providers/payment.provider';
import { createPayosProviderFromEnv } from './providers/payos.provider';
import { assertTransition } from '../../utils/state-machine';

type Repo = Pick<
  PaymentsRepository,
  'create' | 'findById' | 'findByOrderCode' | 'findLivePending' | 'findPending' | 'updateById' | 'transition' | 'markFulfilled' | 'findPaidUnfulfilled' | 'findExpiredPending' | 'paidTotal'
>;

export class PaymentsService {
  /** paymentId -> time of the last reconciliation request to the gateway (throttle for polling clients). */
  private readonly lastSync = new Map<string, number>();

  constructor(
    private readonly payments: Repo = paymentsRepository,
    private readonly provider: PaymentProvider = createPayosProviderFromEnv(),
    private readonly bookings: Pick<BookingsService, 'getPayable' | 'confirmPayment'> = bookingsService,
    private readonly notifications: Pick<NotificationsService, 'notify'> = notificationsService,
  ) {}

  // ============================================================== Checkout

  /** Use case "Make payment" for a booking. The amount comes from the booking on the server; the client sends nothing. */
  async createBookingCheckout(travelerId: string, bookingId: string): Promise<CheckoutDto> {
    const payable = await this.bookings.getPayable(travelerId, bookingId);
    return this.createCheckout({
      purpose: PAYMENT_PURPOSE.BOOKING,
      userId: travelerId,
      referenceId: payable.bookingId,
      amount: payable.amount,
      description: payable.description,
      expiresAt: payable.expiresAt,
    });
  }

  /**
   * Generic checkout (also used by `subscriptions`). Idempotent: while a live PENDING payment exists for the same
   * purpose + reference, the same link is returned instead of creating a second one.
   */
  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutDto> {
    for (let round = 0; round < PAYMENT_POLICY.CHECKOUT_MAX_ROUNDS; round += 1) {
      const live = await this.payments.findLivePending(input.purpose, input.referenceId, new Date());
      if (live?.checkoutUrl) return toCheckoutDto(live);

      const created = await this.createPendingPayment(input);
      if (created) return this.attachPaymentLink(created.payment, created.orderCode, input);

      // The unique "one open payment" index said no: either a parallel request is creating the link right now
      // (wait for it) or an expired payment that the sweep has not closed yet is in the way (close it).
      const blocking = await this.payments.findPending(input.purpose, input.referenceId);
      if (blocking && blocking.expiresAt.getTime() <= Date.now()) {
        await this.payments.transition(blocking.id, [PAYMENT_STATUS.PENDING], { $set: { status: PAYMENT_STATUS.EXPIRED } });
      } else {
        await new Promise((resolve) => setTimeout(resolve, PAYMENT_POLICY.CHECKOUT_RETRY_DELAY_MS));
      }
    }
    throw AppError.conflict('The payment is being prepared, please retry in a moment', 'PAYMENT_IN_PROGRESS');
  }

  private async attachPaymentLink(payment: PaymentDocument, orderCode: number, input: CreateCheckoutInput): Promise<CheckoutDto> {
    try {
      const link = await this.provider.createPaymentLink({
        orderCode,
        amount: input.amount,
        description: payment.description,
        returnUrl: withPaymentId(returnUrl(), payment.id),
        cancelUrl: withPaymentId(cancelUrl(), payment.id),
        expiresAt: input.expiresAt,
      });
      const updated = await this.payments.updateById(payment.id, {
        $set: { providerPaymentLinkId: link.providerPaymentLinkId, checkoutUrl: link.checkoutUrl },
      });
      return toCheckoutDto(updated ?? payment);
    } catch (error) {
      await this.payments.transition(payment.id, [PAYMENT_STATUS.PENDING], {
        $set: { status: PAYMENT_STATUS.FAILED, failureReason: 'PROVIDER_ERROR' },
      });
      throw error;
    }
  }

  /**
   * Inserts the PENDING payment. Returns null when another open payment exists for the same reference; on the (very
   * unlikely) order-code collision with another process it picks a new code.
   */
  private async createPendingPayment(input: CreateCheckoutInput): Promise<{ payment: PaymentDocument; orderCode: number } | null> {
    for (let attempt = 1; ; attempt += 1) {
      const orderCode = generateOrderCode();
      try {
        const payment = await this.payments.create({
          purpose: input.purpose,
          userId: input.userId as never,
          referenceId: input.referenceId as never,
          amount: input.amount,
          description: input.description.slice(0, PAYMENT_POLICY.MAX_DESCRIPTION_LENGTH),
          provider: this.provider.name,
          providerOrderCode: orderCode,
          expiresAt: input.expiresAt,
        });
        return { payment, orderCode };
      } catch (error) {
        const { code, keyPattern } = error as { code?: number; keyPattern?: Record<string, unknown> };
        if (code !== 11000) throw error;
        if (keyPattern && 'referenceId' in keyPattern) return null;
        if (attempt >= 3) throw error;
      }
    }
  }

  /** A user's own payment. While PENDING the real state is fetched from the gateway (covers a missed webhook). */
  async getMine(userId: string, id: string): Promise<PaymentDto> {
    let payment = await this.requireOwned(userId, id);
    if (payment.status === PAYMENT_STATUS.PENDING && this.syncDue(payment.id)) {
      payment = (await this.syncWithProvider(payment)) ?? payment;
    }
    return toPaymentDto(payment);
  }

  /** True at most once per `SYNC_MIN_INTERVAL_MS` per payment: a client polling in a loop must not become a request storm against the gateway. */
  private syncDue(paymentId: string): boolean {
    const now = Date.now();
    const last = this.lastSync.get(paymentId);
    if (last !== undefined && now - last < PAYMENT_POLICY.SYNC_MIN_INTERVAL_MS) return false;
    if (this.lastSync.size >= PAYMENT_POLICY.SYNC_TRACKED_PAYMENTS) {
      for (const [id, at] of this.lastSync) if (now - at >= PAYMENT_POLICY.SYNC_MIN_INTERVAL_MS) this.lastSync.delete(id);
      if (this.lastSync.size >= PAYMENT_POLICY.SYNC_TRACKED_PAYMENTS) this.lastSync.clear();
    }
    this.lastSync.set(paymentId, now);
    return true;
  }

  // =============================================================== Webhook

  /**
   * Gateway callback. The signature is verified first (400 if invalid); after that the order is looked up by OUR order
   * code and the amount compared with what we stored — nothing the payload claims about price or status is trusted
   * beyond that. Idempotent: replays never apply the business effect twice.
   */
  async handleWebhook(payload: unknown): Promise<{ handled: boolean }> {
    const event = this.provider.verifyWebhook(payload);
    const payment = await this.payments.findByOrderCode(event.orderCode);
    if (!payment) {
      logger.warn(`Webhook for unknown order ${event.orderCode} ignored`);
      return { handled: false };
    }
    if (!event.success) return { handled: false };

    if (event.amount !== payment.amount) {
      logger.error(`Webhook amount mismatch for payment ${payment.id}: expected ${payment.amount}, got ${event.amount}`);
      await this.payments.updateById(payment.id, { $set: { failureReason: 'AMOUNT_MISMATCH' } });
      return { handled: false };
    }

    await this.settlePaid(payment, event.reference);
    return { handled: true };
  }

  /** Money received for one purpose, e.g. SUBSCRIPTION revenue on the admin dashboard. */
  paidTotal(purpose: PaymentPurpose): Promise<{ amount: number; count: number }> {
    return this.payments.paidTotal(purpose);
  }

  // ============================================================ Maintenance

  /** Closes PENDING payments past their expiry. A payment that was actually paid (missed webhook) is settled instead. */
  async expireStalePayments(now = new Date()): Promise<number> {
    const due = await this.payments.findExpiredPending(now, PAYMENT_POLICY.MAINTENANCE_BATCH);
    let expired = 0;
    for (const payment of due) {
      try {
        const synced = await this.syncWithProvider(payment);
        if (synced && synced.status !== PAYMENT_STATUS.PENDING) continue;
        if (await this.payments.transition(payment.id, [PAYMENT_STATUS.PENDING], { $set: { status: PAYMENT_STATUS.EXPIRED } })) {
          expired += 1;
        }
      } catch (error) {
        logger.error(`Could not expire payment ${payment.id}`, { message: (error as Error).message });
      }
    }
    return expired;
  }

  /** Re-applies the business effect of PAID payments whose fulfilment handler failed earlier. */
  async retryUnfulfilled(): Promise<number> {
    const stuck = await this.payments.findPaidUnfulfilled(PAYMENT_POLICY.MAINTENANCE_BATCH);
    let fixed = 0;
    for (const payment of stuck) {
      if (await this.fulfil(payment)) fixed += 1;
    }
    return fixed;
  }

  // ================================================================ helpers

  private async requireOwned(userId: string, id: string): Promise<PaymentDocument> {
    const payment = await this.payments.findById(id);
    if (!payment || String(payment.userId) !== userId) throw AppError.notFound('Payment not found');
    return payment;
  }

  /** Asks the gateway for the truth and applies it. Returns the updated payment, or null if the gateway is unavailable. */
  private async syncWithProvider(payment: PaymentDocument): Promise<PaymentDocument | null> {
    try {
      const remote = await this.provider.getPaymentStatus(payment.providerOrderCode);
      if (remote.state === 'PAID' && remote.amountPaid >= payment.amount) {
        return await this.settlePaid(payment);
      }
      if (remote.state === 'CANCELLED' || remote.state === 'EXPIRED') {
        const next: PaymentStatus = remote.state === 'CANCELLED' ? PAYMENT_STATUS.CANCELLED : PAYMENT_STATUS.EXPIRED;
        assertTransition(PAYMENT_TRANSITIONS, payment.status as PaymentStatus, next, 'Payment');
        return (await this.payments.transition(payment.id, [PAYMENT_STATUS.PENDING], { $set: { status: next } })) ?? payment;
      }
      return payment;
    } catch (error) {
      logger.warn(`Payment sync skipped for ${payment.id}`, { message: (error as Error).message });
      return null;
    }
  }

  /** PENDING / EXPIRED / CANCELLED / FAILED -> PAID (first caller wins), then fulfil once. Always safe to call again. */
  private async settlePaid(payment: PaymentDocument, reference?: string): Promise<PaymentDocument> {
    let current = payment;
    if (payment.status !== PAYMENT_STATUS.PAID) {
      assertTransition(PAYMENT_TRANSITIONS, payment.status as PaymentStatus, PAYMENT_STATUS.PAID, 'Payment');
      const paid = await this.payments.transition(
        payment.id,
        [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.EXPIRED, PAYMENT_STATUS.CANCELLED, PAYMENT_STATUS.FAILED],
        { $set: { status: PAYMENT_STATUS.PAID, paidAt: new Date(), ...(reference ? { providerReference: reference } : {}) }, $unset: { failureReason: 1 } },
      );
      // null = a concurrent webhook already settled it; fall through and let fulfil() be the single gate.
      current = paid ?? (await this.payments.findById(payment.id)) ?? payment;
    }
    await this.fulfil(current);
    return (await this.payments.findById(payment.id)) ?? current;
  }

  /** Applies the business effect exactly once (`fulfilledAt` is the gate). Never throws: failures are retried by the job. */
  private async fulfil(payment: PaymentDocument): Promise<boolean> {
    if (payment.fulfilledAt) return false;
    const facts = toPaymentFacts(payment);
    try {
      if (facts.purpose === PAYMENT_PURPOSE.BOOKING) {
        await this.bookings.confirmPayment(facts.referenceId);
      } else {
        const handler = paymentEvents.handlerFor(facts.purpose);
        if (!handler) throw new Error(`No fulfilment handler registered for purpose ${facts.purpose}`);
        await handler(facts);
      }
    } catch (error) {
      logger.error(`Fulfilment failed for payment ${facts.id} (will be retried)`, { message: (error as Error).message });
      return false;
    }

    const marked = await this.payments.markFulfilled(payment.id);
    if (marked) {
      await this.notifications.notify(facts.userId, {
        type: NOTIFICATION_TYPE.PAYMENT_SUCCEEDED,
        title: 'Payment received',
        body: `We received your payment of ${facts.amount.toLocaleString('en-US')} VND.`,
        data: { paymentId: facts.id },
      });
    }
    return Boolean(marked);
  }
}

let lastOrderCode = 0;
/**
 * Unique positive integer < 2^53 (milliseconds * 1000 + offset, ~16 digits). Strictly increasing inside a process, so two
 * payments created in the same millisecond never collide; the random offset separates processes (the unique index
 * on `providerOrderCode` is the final guard, see `createCheckout`).
 */
export function generateOrderCode(): number {
  lastOrderCode = Math.max(Date.now() * 1000 + randomInt(0, 500), lastOrderCode + 1);
  return lastOrderCode;
}

function baseClientUrl(): string {
  return (env.CLIENT_URL.split(',')[0] ?? 'http://localhost:3000').trim().replace(/\/$/, '');
}
const returnUrl = () => env.PAYMENT_RETURN_URL ?? `${baseClientUrl()}/payment/success`;
const cancelUrl = () => env.PAYMENT_CANCEL_URL ?? `${baseClientUrl()}/payment/cancel`;
const withPaymentId = (url: string, paymentId: string) => `${url}${url.includes('?') ? '&' : '?'}paymentId=${paymentId}`;

export const paymentsService = new PaymentsService();
