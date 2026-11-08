export type ConsumePromotionResult = { success: true } | { success: false; reason: 'EXHAUSTED' | 'USER_LIMIT_REACHED' };

import { containsText } from '../../utils/search';
import type { ListPromotionsQuery } from './promotions.types';
import type { PromotionScope } from '@travel-platform/constants';
import { nullIfNotFound, prisma, type DbExecutor, type Prisma } from '../../config/database';
import type { Promotion as StoredPromotion, PromotionCodeInstance, UserVoucher } from '../../generated/prisma/client';
import { numericRecord, type NumericRecord } from '../../utils/money';
type Promotion = NumericRecord<StoredPromotion>;
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
      | 'isArchived'
      | 'deactivationReason'
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
    | 'isArchived'
    | 'deactivationReason'
  >
>;

export class PromotionsRepository {
  async create(data: NewPromotion): Promise<PromotionRecord> {
    return numericRecord(await prisma.promotion.create({
      data: {
        ...data,
        code: data.code ? data.code.toUpperCase() : undefined,
      },
    }));
  }

  async findById(id: string): Promise<PromotionRecord | null> {
    const row = await prisma.promotion.findUnique({ where: { id } });
    return row ? numericRecord(row) : null;
  }

  async findByCode(
    code: string,
    db: DbExecutor = prisma,
  ): Promise<{ promotion: PromotionRecord; codeInstance?: PromotionCodeInstanceRecord } | null> {
    const upper = code.toUpperCase();
    const promotion = await db.promotion.findUnique({ where: { code: upper } });
    if (promotion) return { promotion: numericRecord(promotion) };

    const instance = await db.promotionCodeInstance.findUnique({
      where: { code: upper },
      include: { promotion: true },
    });
    if (instance && instance.promotion) {
      return { promotion: numericRecord(instance.promotion), codeInstance: instance };
    }
    return null;
  }

  async updateById(id: string, patch: PromotionPatch): Promise<PromotionRecord | null> {
    const row = await prisma.promotion.update({ where: { id }, data: patch }).catch(nullIfNotFound);
    return row ? numericRecord(row) : null;
  }

  async list(filter: { scope?: PromotionScope; ownerId?: string } & Omit<ListPromotionsQuery, 'page' | 'limit'>, page: PageRequest) {
    const where: Prisma.PromotionWhereInput = filter.scope ? { scope: filter.scope } : {};
    if (filter.ownerId) where.ownerId = filter.ownerId;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;
    if (filter.isArchived !== undefined) where.isArchived = filter.isArchived;
    if (filter.applyType) where.applyType = filter.applyType;
    if (filter.codeType) where.codeType = filter.codeType;
    if (filter.q) where.OR = [{ code: containsText(filter.q) }, { title: containsText(filter.q) }];
    if (filter.discountType) where.discountType = filter.discountType;
    if (filter.from && filter.to) { where.startsAt = { lte: filter.to }; where.endsAt = { gte: filter.from }; }
    const [items, total] = await Promise.all([
      prisma.promotion.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: toSkip(page), take: page.limit }),
      prisma.promotion.count({ where }),
    ]);
    return { items: items.map(numericRecord), total };
  }

  /** Atomically takes one redemption; enforces global quota and user usage limit in a single transaction with row locking. */
  async consume(id: string, userId?: string, db?: DbExecutor): Promise<ConsumePromotionResult> {
    const work = async (tx: DbExecutor): Promise<ConsumePromotionResult> => {
      const rows = await tx.$queryRaw<
        Array<{ id: string; usedCount: number; usageLimit: number | null; usageLimitPerUser: number | null; isActive: boolean }>
      >`
        SELECT "id", "usedCount", "usageLimit", "usageLimitPerUser", "isActive"
        FROM "Promotion"
        WHERE "id" = ${id}::uuid
        FOR UPDATE
      `;
      const promo = rows[0];
      if (!promo || !promo.isActive) {
        return { success: false, reason: 'EXHAUSTED' };
      }

      if (promo.usageLimit != null && promo.usedCount >= promo.usageLimit) {
        return { success: false, reason: 'EXHAUSTED' };
      }

      if (userId && promo.usageLimitPerUser != null) {
        const [redemptionsCount, legacyCount] = await Promise.all([
          tx.promotionRedemption.count({
            where: {
              promotionId: id,
              booking: { travelerId: userId, status: { not: 'CANCELLED' } },
            },
          }),
          tx.booking.count({
            where: {
              travelerId: userId,
              status: { not: 'CANCELLED' },
              promotionId: id,
              redemptions: { none: {} },
            },
          }),
        ]);
        if (redemptionsCount + legacyCount >= promo.usageLimitPerUser) {
          return { success: false, reason: 'USER_LIMIT_REACHED' };
        }
      }

      await tx.$executeRaw`
        UPDATE "Promotion"
        SET "usedCount" = "usedCount" + 1
        WHERE "id" = ${id}::uuid
      `;

      return { success: true };
    };
    return db ? work(db) : prisma.$transaction(work);

  }

  /** Gives a redemption back (booking cancelled / payment expired). Never goes below 0. */
  async release(id: string, db: DbExecutor = prisma): Promise<void> {
    await db.promotion.updateMany({ where: { id, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
  }

  /** Lock parents in one deterministic order before touching instances or counters. */
  async lockPromotions(ids: readonly string[], db: DbExecutor): Promise<void> {
    for (const id of [...new Set(ids)].sort()) {
      await db.$queryRaw`SELECT "id" FROM "Promotion" WHERE "id" = ${id}::uuid FOR UPDATE`;
    }
  }

  findUsedCodesByBooking(bookingId: string, db: DbExecutor): Promise<PromotionCodeInstanceRecord[]> {
    return db.promotionCodeInstance.findMany({ where: { bookingId, isUsed: true }, orderBy: [{ promotionId: 'asc' }, { id: 'asc' }] });
  }

  findRedemptionsByBooking(bookingId: string, db: DbExecutor) {
    return db.promotionRedemption.findMany({ where: { bookingId }, select: { promotionId: true, codeInstanceId: true } });
  }

  async isUniqueBatch(id: string, db: DbExecutor): Promise<boolean> {
    const row = await db.promotion.findUnique({ where: { id }, select: { codeType: true } });
    return row?.codeType === 'UNIQUE_BATCH';
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
    const p = page?.page && page?.limit ? page : { page: 1, limit: 20 };
    const [items, total] = await Promise.all([
      prisma.promotionCodeInstance.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: toSkip(p),
        take: p.limit,
      }),
      prisma.promotionCodeInstance.count({ where }),
    ]);
    return { items, total };
  }

  async consumeCodeInstance(instanceId: string, bookingId: string, usedById: string, db: DbExecutor): Promise<boolean> {
    const changed = await db.$executeRaw`
      UPDATE "PromotionCodeInstance"
      SET "isUsed" = true, "usedAt" = NOW(), "bookingId" = ${bookingId}::uuid, "usedById" = ${usedById}::uuid
      WHERE "id" = ${instanceId}::uuid AND NOT "isUsed"`;
    return changed === 1;
  }

  async releaseCodeInstance(instanceId: string, bookingId: string, db: DbExecutor): Promise<boolean> {
    const result = await db.promotionCodeInstance.updateMany({
      where: { id: instanceId, bookingId, isUsed: true },
      data: { isUsed: false, usedAt: null, bookingId: null, usedById: null },
    });
    return result.count === 1;
  }

  // --- User Vouchers ---
  async collectUserVoucher(userId: string, promotionId: string): Promise<UserVoucherRecord> {
    const row = await prisma.userVoucher.upsert({
      where: { userId_promotionId: { userId, promotionId } },
      create: { userId, promotionId },
      update: {},
      include: { promotion: true },
    });
    return { ...row, promotion: numericRecord(row.promotion) };
  }

  async listUserVouchers(userId: string): Promise<UserVoucherRecord[]> {
    const rows = await prisma.userVoucher.findMany({
      where: { userId },
      include: { promotion: true },
      orderBy: { collectedAt: 'desc' },
    });
    return rows.map((row) => ({ ...row, promotion: numericRecord(row.promotion) }));
  }

  async countUserUsages(userId: string, promotionId: string, db: DbExecutor = prisma): Promise<number> {
    const [redemptionCount, legacyBookingCount] = await Promise.all([
      db.promotionRedemption.count({
        where: {
          promotionId,
          booking: {
            travelerId: userId,
            status: { not: 'CANCELLED' },
          },
        },
      }),
      db.booking.count({
        where: {
          travelerId: userId,
          status: { not: 'CANCELLED' },
          promotionId,
          redemptions: { none: {} },
        },
      }),
    ]);
    return redemptionCount + legacyBookingCount;

  }

  async findExpiringUserVouchers(windowHours: number = 48, now = new Date()): Promise<UserVoucherRecord[]> {
    const windowEnd = new Date(now.getTime() + windowHours * 60 * 60 * 1000);
    const rows = await prisma.userVoucher.findMany({
      where: {
        isUsed: false,
        promotion: {
          isActive: true,
          startsAt: { lte: now },
          endsAt: { gt: now, lte: windowEnd },
        },
      },
      include: { promotion: true },
    });
    return rows.map((row) => ({ ...row, promotion: numericRecord(row.promotion) }));
  }
}

export const promotionsRepository = new PromotionsRepository();

