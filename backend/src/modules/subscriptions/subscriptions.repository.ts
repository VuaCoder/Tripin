import type { UpdateQuery } from 'mongoose';
import { toSkip, type PageRequest } from '../../utils/pagination';
import {
  PlanModel,
  SubscriptionModel,
  type PlanAttributes,
  type PlanDocument,
  type SubscriptionAttributes,
  type SubscriptionDocument,
} from './subscriptions.model';
import { SUBSCRIPTION_STATUS, type SubscriptionStatus } from './subscriptions.types';

export class SubscriptionsRepository {
  // ---- plans
  listActivePlans(): Promise<PlanDocument[]> {
    return PlanModel.find({ isActive: true }).sort({ sortOrder: 1, price: 1 }).exec();
  }

  findPlanById(id: string): Promise<PlanDocument | null> {
    return PlanModel.findById(id).exec();
  }

  /**
   * Seed helper: creates the plan when its code is unknown and NEVER touches an existing one, so prices edited by the
   * owner in the database survive a re-run. Returns true when a plan was created.
   */
  async createPlanIfAbsent(code: string, data: Partial<PlanAttributes>): Promise<boolean> {
    const result = await PlanModel.updateOne({ code }, { $setOnInsert: { ...data, code } }, { upsert: true }).exec();
    return result.upsertedCount === 1;
  }

  // ---- subscriptions
  create(data: Partial<SubscriptionAttributes>): Promise<SubscriptionDocument> {
    return SubscriptionModel.create(data);
  }

  findById(id: string): Promise<SubscriptionDocument | null> {
    return SubscriptionModel.findById(id).exec();
  }

  /** An unpaid subscription of the same plan, so pressing "subscribe" twice reuses it. */
  findPending(userId: string, planId: string): Promise<SubscriptionDocument | null> {
    return SubscriptionModel.findOne({ userId, planId, status: SUBSCRIPTION_STATUS.PENDING_PAYMENT }).sort({ createdAt: -1 }).exec();
  }

  /** The subscription with the latest end date that is currently ACTIVE. */
  findCurrentActive(userId: string, now: Date): Promise<SubscriptionDocument | null> {
    return SubscriptionModel.findOne({ userId, status: SUBSCRIPTION_STATUS.ACTIVE, endsAt: { $gt: now } }).sort({ endsAt: -1 }).exec();
  }

  /** Compare-and-set on status. */
  transition(id: string, expected: readonly SubscriptionStatus[], update: UpdateQuery<SubscriptionAttributes>): Promise<SubscriptionDocument | null> {
    return SubscriptionModel.findOneAndUpdate({ _id: id, status: { $in: expected } }, update, { returnDocument: 'after' }).exec();
  }

  async listByUser(userId: string, page: PageRequest) {
    const [items, total] = await Promise.all([
      SubscriptionModel.find({ userId }).sort({ createdAt: -1, _id: -1 }).skip(toSkip(page)).limit(page.limit).exec(),
      SubscriptionModel.countDocuments({ userId }).exec(),
    ]);
    return { items, total };
  }

  countActive(now: Date): Promise<number> {
    return SubscriptionModel.countDocuments({ status: SUBSCRIPTION_STATUS.ACTIVE, endsAt: { $gt: now } }).exec();
  }

  findEnded(now: Date, limit: number): Promise<SubscriptionDocument[]> {
    return SubscriptionModel.find({ status: SUBSCRIPTION_STATUS.ACTIVE, endsAt: { $lte: now } }).limit(limit).exec();
  }

  findAbandoned(createdBefore: Date, limit: number): Promise<SubscriptionDocument[]> {
    return SubscriptionModel.find({ status: SUBSCRIPTION_STATUS.PENDING_PAYMENT, createdAt: { $lt: createdBefore } }).limit(limit).exec();
  }
}

export const subscriptionsRepository = new SubscriptionsRepository();
