import { prisma, type Prisma } from '../../config/database';
import type { Earning } from '../../generated/prisma/client';
import { toSkip, type PageRequest } from '../../utils/pagination';
import type { EarningsRange } from './earnings.types';

export type EarningRecord = Earning;

export type NewEarning = Omit<Earning, 'id' | 'createdAt'>;

export class EarningsRepository {
  create(data: NewEarning): Promise<EarningRecord> {
    return prisma.earning.create({ data });
  }

  findByBookingId(bookingId: string): Promise<EarningRecord | null> {
    return prisma.earning.findUnique({ where: { bookingId } });
  }

  async listByGuide(guideId: string, range: EarningsRange, page: PageRequest) {
    const where = this.whereOf(guideId, range);
    const [items, total] = await Promise.all([
      prisma.earning.findMany({ where, orderBy: [{ earnedAt: 'desc' }, { id: 'desc' }], skip: toSkip(page), take: page.limit }),
      prisma.earning.count({ where }),
    ]);
    return { items, total };
  }

  /** Totals per calendar month (UTC) inside the range. */
  async summarize(guideId: string, range: EarningsRange): Promise<{ month: string; totalAmount: number; count: number }[]> {
    return prisma.$queryRaw<{ month: string; totalAmount: number; count: number }[]>`
      SELECT to_char("earnedAt" AT TIME ZONE 'UTC', 'YYYY-MM') AS "month",
             COALESCE(SUM("amount"), 0)::float8 AS "totalAmount", COUNT(*)::float8 AS "count"
      FROM "Earning"
      WHERE "guideId" = ${guideId}::uuid
        AND (${range.from ?? null}::timestamptz IS NULL OR "earnedAt" >= ${range.from ?? null}::timestamptz)
        AND (${range.to ?? null}::timestamptz IS NULL OR "earnedAt" <= ${range.to ?? null}::timestamptz)
      GROUP BY 1 ORDER BY 1 DESC`;
  }

  private whereOf(guideId: string, range: EarningsRange): Prisma.EarningWhereInput {
    return { guideId, ...(range.from || range.to ? { earnedAt: { gte: range.from, lte: range.to } } : {}) };
  }
}

export const earningsRepository = new EarningsRepository();
