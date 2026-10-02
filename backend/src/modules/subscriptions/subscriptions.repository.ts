import { nullIfNotFound, prisma } from '../../config/database';
import type { Subscription, SubscriptionPlan } from '../../generated/prisma/client';
import { toSkip, type PageRequest } from '../../utils/pagination';
import { SUBSCRIPTION_STATUS, type SubscriptionStatus } from './subscriptions.types';

export type PlanRecord = SubscriptionPlan;
export type SubscriptionRecord = Subscription;

export type NewPlan = Pick<SubscriptionPlan, 'code' | 'name' | 'price' | 'durationDays'> &
  Partial<Pick<SubscriptionPlan, 'description' | 'benefits' | 'isActive' | 'sortOrder'>>;

export type NewSubscription = Pick<Subscription, 'userId' | 'planId' | 'planCode' | 'planName' | 'price' | 'durationDays'> &
  Partial<Pick<Subscription, 'status' | 'startsAt' | 'endsAt'>>;

export type SubscriptionPatch = Partial<Pick<Subscription, 'status' | 'startsAt' | 'endsAt'>>;

export class SubscriptionsRepository {
  // ---- plans
  listActivePlans(): Promise<PlanRecord[]> {
    return prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }] });
  }

  findPlanById(id: string): Promise<PlanRecord | null> {
    return prisma.subscriptionPlan.findUnique({ where: { id } });
  }

  /**
   * Seed helper: creates the plan when its code is unknown and NEVER touches an existing one, so prices edited by the
   * owner in the database survive a re-run. Returns true when a plan was created.
   */
  async createPlanIfAbsent(code: string, data: Omit<NewPlan, 'code'>): Promise<boolean> {
    const result = await prisma.subscriptionPlan.createMany({ data: [{ ...data, code }], skipDuplicates: true });
    return result.count === 1;
  }

  // ---- subscriptions
  create(data: NewSubscription): Promise<SubscriptionRecord> {
    return prisma.subscription.create({ data });
  }

  findById(id: string): Promise<SubscriptionRecord | null> {
    return prisma.subscription.findUnique({ where: { id } });
  }

  /** An unpaid subscription of the same plan, so pressing "subscribe" twice reuses it. */
  findPending(userId: string, planId: string): Promise<SubscriptionRecord | null> {
    return prisma.subscription.findFirst({ where: { userId, planId, status: SUBSCRIPTION_STATUS.PENDING_PAYMENT }, orderBy: { createdAt: 'desc' } });
  }

  /** The subscription with the latest end date that is currently ACTIVE. */
  findCurrentActive(userId: string, now: Date): Promise<SubscriptionRecord | null> {
    return prisma.subscription.findFirst({ where: { userId, status: SUBSCRIPTION_STATUS.ACTIVE, endsAt: { gt: now } }, orderBy: { endsAt: 'desc' } });
  }

  /** Compare-and-set on status. */
  transition(id: string, expected: readonly SubscriptionStatus[], patch: SubscriptionPatch): Promise<SubscriptionRecord | null> {
    return prisma.subscription.update({ where: { id, status: { in: [...expected] } }, data: patch }).catch(nullIfNotFound);
  }

  async listByUser(userId: string, page: PageRequest) {
    const [items, total] = await Promise.all([
      prisma.subscription.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: toSkip(page), take: page.limit }),
      prisma.subscription.count({ where: { userId } }),
    ]);
    return { items, total };
  }

  countActive(now: Date): Promise<number> {
    return prisma.subscription.count({ where: { status: SUBSCRIPTION_STATUS.ACTIVE, endsAt: { gt: now } } });
  }

  findEnded(now: Date, limit: number): Promise<SubscriptionRecord[]> {
    return prisma.subscription.findMany({ where: { status: SUBSCRIPTION_STATUS.ACTIVE, endsAt: { lte: now } }, take: limit });
  }

  findAbandoned(createdBefore: Date, limit: number): Promise<SubscriptionRecord[]> {
    return prisma.subscription.findMany({ where: { status: SUBSCRIPTION_STATUS.PENDING_PAYMENT, createdAt: { lt: createdBefore } }, take: limit });
  }
}

export const subscriptionsRepository = new SubscriptionsRepository();
