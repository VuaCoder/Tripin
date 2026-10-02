import type { PromotionScope } from '@travel-platform/constants';
import { nullIfNotFound, prisma, type Prisma } from '../../config/database';
import type { Promotion } from '../../generated/prisma/client';
import { toSkip, type PageRequest } from '../../utils/pagination';

export type PromotionRecord = Promotion;

export type NewPromotion = Pick<
  Promotion,
  'scope' | 'code' | 'title' | 'discountType' | 'discountValue' | 'startsAt' | 'endsAt' | 'createdById'
> &
  Partial<Pick<Promotion, 'ownerId' | 'description' | 'maxDiscountAmount' | 'minOrderAmount' | 'usageLimit' | 'isActive'>>;

export type PromotionPatch = Partial<
  Pick<Promotion, 'title' | 'description' | 'discountType' | 'discountValue' | 'maxDiscountAmount' | 'minOrderAmount' | 'startsAt' | 'endsAt' | 'usageLimit' | 'isActive'>
>;

export class PromotionsRepository {
  create(data: NewPromotion): Promise<PromotionRecord> {
    return prisma.promotion.create({ data: { ...data, code: data.code.toUpperCase() } });
  }

  findById(id: string): Promise<PromotionRecord | null> {
    return prisma.promotion.findUnique({ where: { id } });
  }

  findByCode(code: string): Promise<PromotionRecord | null> {
    return prisma.promotion.findUnique({ where: { code: code.toUpperCase() } });
  }

  updateById(id: string, patch: PromotionPatch): Promise<PromotionRecord | null> {
    return prisma.promotion.update({ where: { id }, data: patch }).catch(nullIfNotFound);
  }

  async list(filter: { scope: PromotionScope; ownerId?: string; isActive?: boolean }, page: PageRequest) {
    const where: Prisma.PromotionWhereInput = { scope: filter.scope };
    if (filter.ownerId) where.ownerId = filter.ownerId;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;
    const [items, total] = await Promise.all([
      prisma.promotion.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: toSkip(page), take: page.limit }),
      prisma.promotion.count({ where }),
    ]);
    return { items, total };
  }

  /** Atomically takes one redemption; false when the limit is already reached (no over-redeeming under concurrency). */
  async consume(id: string): Promise<boolean> {
    const changed = await prisma.$executeRaw`
      UPDATE "Promotion" SET "usedCount" = "usedCount" + 1
      WHERE "id" = ${id}::uuid AND "isActive" AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`;
    return changed === 1;
  }

  /** Gives a redemption back (booking cancelled / payment expired). Never goes below 0. */
  async release(id: string): Promise<void> {
    await prisma.promotion.updateMany({ where: { id, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
  }
}

export const promotionsRepository = new PromotionsRepository();
