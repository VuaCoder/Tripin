import { containsText } from '../../utils/search';
import type { ListPromotionsQuery } from './promotions.types';
import type { PromotionScope } from '@travel-platform/constants';
import { nullIfNotFound, prisma, type Prisma } from '../../config/database';
import type { Promotion, PromotionCodeInstance, UserVoucher } from '../../generated/prisma/client';
import { toSkip, type PageRequest } from '../../utils/pagination';

export type PromotionRecord = Promotion;
export type PromotionCodeInstanceRecord = PromotionCodeInstance;
export type UserVoucherRecord = UserVoucher & { promotion?: Promotion };

export type NewPromotion = Pick<
  Promotion,
  'scope' | 'title' | 'discountType' | 'discountValue' | 'startsAt' | 'endsAt' | 'createdById'
> &
  Partial<
    Pick<
      Promotion,
      | 'code'
      | 'ownerId'
      | 'description'
      | 'maxDiscountAmount'
      | 'minOrderAmount'
      | 'minParticipants'
      | 'daysInAdvance'
      | 'firstBookingOnly'
      | 'targetTourIds'
      | 'usageLimit'
      | 'usageLimitPerUser'
      | 'applyType'
      | 'codeType'
      | 'isActive'
    >
  >;

export type PromotionPatch = Partial<
  Pick<
    Promotion,
    | 'title'
    | 'description'
    | 'discountType'
    | 'discountValue'
    | 'maxDiscountAmount'
    | 'minOrderAmount'
    | 'minParticipants'
    | 'daysInAdvance'
    | 'firstBookingOnly'
    | 'targetTourIds'
    | 'startsAt'
    | 'endsAt'
    | 'usageLimit'
    | 'usageLimitPerUser'
    | 'isActive'
  >
>;

export class PromotionsRepository {
  create(data: NewPromotion): Promise<PromotionRecord> {
    return prisma.promotion.create({
      data: {
        ...data,
        code: data.code ? data.code.toUpperCase() : undefined,
      },
    });
  }

  findById(id: string): Promise<PromotionRecord | null> {
    return prisma.promotion.findUnique({ where: { id } });
  }

  async findByCode(
    code: string,
  ): Promise<{ promotion: PromotionRecord; codeInstance?: PromotionCodeInstanceRecord } | null> {
    const upper = code.toUpperCase();
    const promotion = await prisma.promotion.findUnique({ where: { code: upper } });
    if (promotion) return { promotion };

    const instance = await prisma.promotionCodeInstance.findUnique({
      where: { code: upper },
      include: { promotion: true },
    });
    if (instance && instance.promotion) {
      return { promotion: instance.promotion, codeInstance: instance };
    }
    return null;
  }

  updateById(id: string, patch: PromotionPatch): Promise<PromotionRecord | null> {
    return prisma.promotion.update({ where: { id }, data: patch }).catch(nullIfNotFound);
  }

  async list(filter: { scope: PromotionScope; ownerId?: string } & Omit<ListPromotionsQuery, 'page' | 'limit'>, page: PageRequest) {
    const where: Prisma.PromotionWhereInput = { scope: filter.scope };
    if (filter.ownerId) where.ownerId = filter.ownerId;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;
    if (filter.applyType) where.applyType = filter.applyType;
    if (filter.q) where.OR = [{ code: containsText(filter.q) }, { title: containsText(filter.q) }];
    if (filter.discountType) where.discountType = filter.discountType;
    if (filter.from && filter.to) { where.startsAt = { lte: filter.to }; where.endsAt = { gte: filter.from }; }
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

  // --- Unique Code Instances ---
  async createCodeInstances(promotionId: string, codes: string[]) {
    return prisma.promotionCodeInstance.createMany({
      data: codes.map((c) => ({
        promotionId,
        code: c.toUpperCase(),
      })),
      skipDuplicates: true,
    });
  }

  async listCodeInstances(promotionId: string, page: PageRequest) {
    const where = { promotionId };
    const [items, total] = await Promise.all([
      prisma.promotionCodeInstance.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: toSkip(page),
        take: page.limit,
      }),
      prisma.promotionCodeInstance.count({ where }),
    ]);
    return { items, total };
  }

  async consumeCodeInstance(instanceId: string, bookingId: string, usedById: string): Promise<boolean> {
    const changed = await prisma.$executeRaw`
      UPDATE "PromotionCodeInstance"
      SET "isUsed" = true, "usedAt" = NOW(), "bookingId" = ${bookingId}::uuid, "usedById" = ${usedById}::uuid
      WHERE "id" = ${instanceId}::uuid AND NOT "isUsed"`;
    return changed === 1;
  }

  async releaseCodeInstance(instanceId: string): Promise<void> {
    await prisma.promotionCodeInstance.update({
      where: { id: instanceId },
      data: { isUsed: false, usedAt: null, bookingId: null, usedById: null },
    });
  }

  // --- User Vouchers ---
  async collectUserVoucher(userId: string, promotionId: string): Promise<UserVoucherRecord> {
    return prisma.userVoucher.upsert({
      where: { userId_promotionId: { userId, promotionId } },
      create: { userId, promotionId },
      update: {},
      include: { promotion: true },
    });
  }

  async listUserVouchers(userId: string): Promise<UserVoucherRecord[]> {
    return prisma.userVoucher.findMany({
      where: { userId },
      include: { promotion: true },
      orderBy: { collectedAt: 'desc' },
    });
  }

  async countUserUsages(userId: string, promotionId: string): Promise<number> {
    return prisma.booking.count({
      where: {
        travelerId: userId,
        status: { not: 'CANCELLED' },
        promotionId,
      },
    });
  }
}

export const promotionsRepository = new PromotionsRepository();

