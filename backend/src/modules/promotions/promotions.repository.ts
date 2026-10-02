import type { QueryFilter, UpdateQuery } from 'mongoose';
import type { PromotionScope } from '@travel-platform/constants';
import { toSkip, type PageRequest } from '../../utils/pagination';
import { PromotionModel, type PromotionAttributes, type PromotionDocument } from './promotions.model';

export class PromotionsRepository {
  create(data: Partial<PromotionAttributes>): Promise<PromotionDocument> {
    return PromotionModel.create(data);
  }

  findById(id: string): Promise<PromotionDocument | null> {
    return PromotionModel.findById(id).exec();
  }

  findByCode(code: string): Promise<PromotionDocument | null> {
    return PromotionModel.findOne({ code: code.toUpperCase() }).exec();
  }

  updateById(id: string, update: UpdateQuery<PromotionAttributes>): Promise<PromotionDocument | null> {
    return PromotionModel.findByIdAndUpdate(id, update, { returnDocument: 'after', runValidators: true }).exec();
  }

  async list(filter: { scope: PromotionScope; ownerId?: string; isActive?: boolean }, page: PageRequest) {
    const query: QueryFilter<PromotionAttributes> = { scope: filter.scope };
    if (filter.ownerId) query.ownerId = filter.ownerId;
    if (filter.isActive !== undefined) query.isActive = filter.isActive;
    const [items, total] = await Promise.all([
      PromotionModel.find(query).sort({ createdAt: -1, _id: -1 }).skip(toSkip(page)).limit(page.limit).exec(),
      PromotionModel.countDocuments(query).exec(),
    ]);
    return { items, total };
  }

  /** Atomically takes one redemption; false when the limit is already reached (no over-redeeming under concurrency). */
  async consume(id: string): Promise<boolean> {
    const result = await PromotionModel.updateOne(
      { _id: id, isActive: true, $or: [{ usageLimit: { $exists: false } }, { usageLimit: null }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }] },
      { $inc: { usedCount: 1 } },
    ).exec();
    return result.modifiedCount === 1;
  }

  /** Gives a redemption back (booking cancelled / payment expired). Never goes below 0. */
  async release(id: string): Promise<void> {
    await PromotionModel.updateOne({ _id: id, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } }).exec();
  }
}

export const promotionsRepository = new PromotionsRepository();
