import { PAYMENT_PURPOSE } from '@travel-platform/constants';
import { AppError } from '../../utils/app-error';
import { logger } from '../../utils/logger';
import { buildPage, type Page } from '../../utils/pagination';
import { assertTransition } from '../../utils/state-machine';
import { NOTIFICATION_TYPE, notificationsService, type NotificationsService } from '../notifications';
import { paymentsService, type PaymentFacts, type PaymentsService } from '../payments';
import { toPlanDto, toSubscriptionDto } from './subscriptions.mapper';
import type { PlanDocument, SubscriptionDocument } from './subscriptions.model';
import { subscriptionsRepository, type SubscriptionsRepository } from './subscriptions.repository';
import {
  SUBSCRIPTION_POLICY,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_TRANSITIONS,
  type CurrentSubscriptionDto,
  type ListSubscriptionsQuery,
  type PlanDto,
  type SubscribeResultDto,
  type SubscriptionDto,
  type SubscriptionStatus,
} from './subscriptions.types';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export class SubscriptionsService {
  constructor(
    private readonly subscriptions: Pick<
      SubscriptionsRepository,
      'listActivePlans' | 'findPlanById' | 'create' | 'findById' | 'findPending' | 'findCurrentActive' | 'transition' | 'listByUser' | 'findEnded' | 'findAbandoned' | 'countActive'
    > = subscriptionsRepository,
    private readonly payments: Pick<PaymentsService, 'createCheckout'> = paymentsService,
    private readonly notifications: Pick<NotificationsService, 'notify'> = notificationsService,
  ) {}

  /** Public list of the plans on sale. */
  async listPlans(): Promise<PlanDto[]> {
    return (await this.subscriptions.listActivePlans()).map(toPlanDto);
  }

  /**
   * Use case "Subscribe to plan" (+ Make payment). Price and duration come from the plan on the server. Pressing the
   * button twice reuses the same unpaid subscription and the same payment link.
   */
  async subscribe(userId: string, planId: string): Promise<SubscribeResultDto> {
    const plan = await this.subscriptions.findPlanById(planId);
    if (!plan || !plan.isActive) throw AppError.notFound('Plan not found');

    const subscription = (await this.subscriptions.findPending(userId, planId)) ?? (await this.createPending(userId, plan));

    const checkout = await this.payments.createCheckout({
      purpose: PAYMENT_PURPOSE.SUBSCRIPTION,
      userId,
      referenceId: subscription.id,
      amount: subscription.price,
      description: plan.code,
      expiresAt: new Date(Date.now() + SUBSCRIPTION_POLICY.PAYMENT_WINDOW_MINUTES * MINUTE_MS),
    });
    return { subscription: toSubscriptionDto(subscription), checkout };
  }

  /** Unique partial index: of two parallel calls one insert fails and that caller takes the winner's subscription. */
  private async createPending(userId: string, plan: PlanDocument): Promise<SubscriptionDocument> {
    try {
      return await this.subscriptions.create({
        userId: userId as never,
        planId: plan._id,
        planCode: plan.code,
        planName: plan.name,
        price: plan.price,
        durationDays: plan.durationDays,
      });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const existing = await this.subscriptions.findPending(userId, String(plan._id));
      if (!existing) throw error;
      return existing;
    }
  }

  async listMine(userId: string, query: ListSubscriptionsQuery): Promise<Page<SubscriptionDto>> {
    const { items, total } = await this.subscriptions.listByUser(userId, query);
    return buildPage(items.map(toSubscriptionDto), total, query);
  }

  async getCurrent(userId: string): Promise<CurrentSubscriptionDto> {
    const current = await this.subscriptions.findCurrentActive(userId, new Date());
    return { active: Boolean(current), subscription: current ? toSubscriptionDto(current) : null };
  }

  /** For other modules: does this user hold a running subscription right now? */
  async hasActiveSubscription(userId: string): Promise<boolean> {
    return Boolean(await this.subscriptions.findCurrentActive(userId, new Date()));
  }

  /** Running subscriptions right now (dashboards). */
  countActive(now = new Date()): Promise<number> {
    return this.subscriptions.countActive(now);
  }

  // ================================================== Payment fulfilment

  /**
   * Registered with `paymentEvents.onPaid('SUBSCRIPTION')`. Idempotent. The period starts now, or when the current
   * active period ends (renewals stack instead of overlapping). Money received always activates the subscription, even
   * if it was cancelled in the meantime.
   */
  async activateFromPayment(payment: PaymentFacts): Promise<void> {
    const subscription = await this.subscriptions.findById(payment.referenceId);
    if (!subscription || String(subscription.userId) !== payment.userId) {
      throw new Error(`Subscription ${payment.referenceId} not found for payment ${payment.id}`);
    }
    if (subscription.status === SUBSCRIPTION_STATUS.ACTIVE || subscription.status === SUBSCRIPTION_STATUS.EXPIRED) return;

    assertTransition(SUBSCRIPTION_TRANSITIONS, subscription.status as SubscriptionStatus, SUBSCRIPTION_STATUS.ACTIVE, 'Subscription');
    const now = new Date();
    const current = await this.subscriptions.findCurrentActive(payment.userId, now);
    const startsAt = current?.endsAt && current.endsAt > now ? current.endsAt : now;
    const endsAt = new Date(startsAt.getTime() + subscription.durationDays * DAY_MS);

    const activated = await this.subscriptions.transition(
      subscription.id,
      [SUBSCRIPTION_STATUS.PENDING_PAYMENT, SUBSCRIPTION_STATUS.CANCELLED],
      { $set: { status: SUBSCRIPTION_STATUS.ACTIVE, startsAt, endsAt } },
    );
    if (!activated) return; // a concurrent delivery already activated it

    await this.notifications.notify(
      payment.userId,
      {
        type: NOTIFICATION_TYPE.SUBSCRIPTION_ACTIVATED,
        title: 'Subscription activated',
        body: `Your "${activated.planName}" plan is active until ${endsAt.toISOString().slice(0, 10)}.`,
        data: { subscriptionId: activated.id },
      },
      { email: true },
    );
  }

  // ============================================================ Maintenance

  /** ACTIVE -> EXPIRED for ended periods. Returns the number processed. */
  async expireEndedSubscriptions(now = new Date()): Promise<number> {
    const due = await this.subscriptions.findEnded(now, SUBSCRIPTION_POLICY.MAINTENANCE_BATCH);
    let expired = 0;
    for (const subscription of due) {
      if (await this.subscriptions.transition(subscription.id, [SUBSCRIPTION_STATUS.ACTIVE], { $set: { status: SUBSCRIPTION_STATUS.EXPIRED } })) {
        expired += 1;
      }
    }
    return expired;
  }

  /** PENDING_PAYMENT -> CANCELLED once the payment window is long over (a late payment can still activate it). */
  async cancelAbandonedSubscriptions(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - 2 * SUBSCRIPTION_POLICY.PAYMENT_WINDOW_MINUTES * MINUTE_MS);
    const stale = await this.subscriptions.findAbandoned(cutoff, SUBSCRIPTION_POLICY.MAINTENANCE_BATCH);
    let cancelled = 0;
    for (const subscription of stale) {
      try {
        if (await this.subscriptions.transition(subscription.id, [SUBSCRIPTION_STATUS.PENDING_PAYMENT], { $set: { status: SUBSCRIPTION_STATUS.CANCELLED } })) {
          cancelled += 1;
        }
      } catch (error) {
        logger.error(`Could not cancel abandoned subscription ${subscription.id}`, { message: (error as Error).message });
      }
    }
    return cancelled;
  }
}

export type { SubscriptionDocument };
export const subscriptionsService = new SubscriptionsService();
