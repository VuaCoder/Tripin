import { nullIfNotFound, prisma } from '../../config/database';
import type { Subscription as StoredSubscription, SubscriptionPlan as StoredPlan } from '../../generated/prisma/client';
import { numericRecord, type NumericRecord } from '../../utils/money';
type Subscription = NumericRecord<StoredSubscription>;
type SubscriptionPlan = NumericRecord<StoredPlan>;
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
  async listActivePlans(): Promise<PlanRecord[]> {
    return (await prisma.subscriptionPlan.findMany({ where: { isActive: true, isPremium: false }, orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }] })).map(numericRecord);
  }

  async findPlanById(id: string): Promise<PlanRecord | null> {
    const row = await prisma.subscriptionPlan.findUnique({ where: { id } });
    return row ? numericRecord(row) : null;
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
  async create(data: NewSubscription): Promise<SubscriptionRecord> {
    return numericRecord(await prisma.subscription.create({ data }));
  }

  async findById(id: string): Promise<SubscriptionRecord | null> {
    const row = await prisma.subscription.findUnique({ where: { id } });
    return row ? numericRecord(row) : null;
  }

  /** An unpaid subscription of the same plan, so pressing "subscribe" twice reuses it. */
  async findPending(userId: string, planId: string): Promise<SubscriptionRecord | null> {
    const row = await prisma.subscription.findFirst({ where: { userId, planId, status: SUBSCRIPTION_STATUS.PENDING_PAYMENT }, orderBy: { createdAt: 'desc' } });
    return row ? numericRecord(row) : null;
  }

  /** The subscription with the latest end date that is currently ACTIVE. */
  async findCurrentActive(userId: string, now: Date): Promise<SubscriptionRecord | null> {
    const row = await prisma.subscription.findFirst({ where: { userId, status: SUBSCRIPTION_STATUS.ACTIVE, startsAt: { lte: now }, endsAt: { gt: now } }, orderBy: { endsAt: 'desc' } });
    return row ? numericRecord(row) : null;
  }

  /** Includes prepaid future periods so repeated renewals keep stacking. */
  async findLatestPaid(userId: string, now: Date): Promise<SubscriptionRecord | null> {
    const row = await prisma.subscription.findFirst({ where: { userId, status: SUBSCRIPTION_STATUS.ACTIVE, endsAt: { gt: now } }, orderBy: { endsAt: 'desc' } });
    return row ? numericRecord(row) : null;
  }

  /** Compare-and-set on status. */
  async transition(id: string, expected: readonly SubscriptionStatus[], patch: SubscriptionPatch): Promise<SubscriptionRecord | null> {
    const row = await prisma.subscription.update({ where: { id, status: { in: [...expected] } }, data: patch }).catch(nullIfNotFound);
    return row ? numericRecord(row) : null;
  }

  async listByUser(userId: string, page: PageRequest) {
    const [items, total] = await Promise.all([
      prisma.subscription.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: toSkip(page), take: page.limit }),
      prisma.subscription.count({ where: { userId } }),
    ]);
    return { items: items.map(numericRecord), total };
  }

  countActive(now: Date): Promise<number> {
    return prisma.subscription.count({ where: { status: SUBSCRIPTION_STATUS.ACTIVE, startsAt: { lte: now }, endsAt: { gt: now } } });
  }

  async findEnded(now: Date, limit: number): Promise<SubscriptionRecord[]> {
    return (await prisma.subscription.findMany({ where: { status: SUBSCRIPTION_STATUS.ACTIVE, endsAt: { lte: now } }, take: limit })).map(numericRecord);
  }

  async findAbandoned(createdBefore: Date, limit: number): Promise<SubscriptionRecord[]> {
    return (await prisma.subscription.findMany({ where: { status: SUBSCRIPTION_STATUS.PENDING_PAYMENT, createdAt: { lt: createdBefore } }, take: limit })).map(numericRecord);
  }
}

export const subscriptionsRepository = new SubscriptionsRepository();
