import { prisma, type Prisma } from '../../config/database';
import type { Earning, GuidePayoutLedger } from '../../generated/prisma/client';
import { writeAudit } from '../audit/audit.writer';
import { AUDIT_ACTIONS } from '../audit/audit.types';
import { AppError } from '../../utils/app-error';
import { toSkip, type PageRequest } from '../../utils/pagination';
import type { EarningsRange } from './earnings.types';

export type EarningRecord = Earning & { payout?: GuidePayoutLedger | null };

export type NewEarning = Omit<Earning, 'id' | 'createdAt'>;

export class EarningsRepository {
  create(data: NewEarning): Promise<EarningRecord> {
    return prisma.$transaction(async tx => {
      const earning = await tx.earning.create({ data });
      const payout = await tx.guidePayoutLedger.create({ data: { earningId: earning.id, guideId: data.guideId, agencyId: data.agencyId, tourId: data.tourId, amount: data.amount } });
      const tour = await tx.tour.findUnique({ where: { id: data.tourId }, select: { title: true } });
      await tx.premiumGuideActivity.create({ data: { userId: data.guideId, tourId: data.tourId, tourTitle: tour?.title ?? 'Tour', action: 'BOOKING_COMPLETED', bookingId: data.bookingId, occurredAt: data.earnedAt } });
      return { ...earning, payout };
    });
  }

  findByBookingId(bookingId: string): Promise<EarningRecord | null> {
    return prisma.earning.findUnique({ where: { bookingId }, include: { payout: true } });
  }

  async listByGuide(guideId: string, range: EarningsRange, page: PageRequest) {
    const where = this.whereOf(guideId, range);
    const [items, total] = await Promise.all([
      prisma.earning.findMany({ where, include: { payout: true }, orderBy: [{ earnedAt: 'desc' }, { id: 'desc' }], skip: toSkip(page), take: page.limit }),
      prisma.earning.count({ where }),
    ]);
    return { items, total };
  }

  /** Totals per calendar month (UTC) inside the range. */
  async summarize(guideId: string, range: EarningsRange): Promise<{ month: string; totalAmount: number; count: number }[]> {
    // Prisma DateTime is a timestamp WITHOUT time zone holding UTC values.
    // Group and compare in UTC, independent of the database session timezone.
    // Bind ISO text: Prisma's Date parameters carry a timestamp type, and
    // casting those to timestamptz would first apply the session timezone.
    const from = range.from?.toISOString() ?? null;
    const to = range.to?.toISOString() ?? null;
    return prisma.$queryRaw<{ month: string; totalAmount: number; count: number }[]>`
      SELECT to_char("earnedAt", 'YYYY-MM') AS "month",
             COALESCE(SUM("amount"), 0)::float8 AS "totalAmount", COUNT(*)::float8 AS "count"
      FROM "Earning"
      WHERE "guideId" = ${guideId}::uuid
        AND (${from}::timestamptz IS NULL OR "earnedAt" >= (${from}::timestamptz AT TIME ZONE 'UTC'))
        AND (${to}::timestamptz IS NULL OR "earnedAt" <= (${to}::timestamptz AT TIME ZONE 'UTC'))
      GROUP BY 1 ORDER BY 1 DESC`;
  }

  private whereOf(guideId: string, range: EarningsRange): Prisma.EarningWhereInput {
    return { guideId, ...(range.from || range.to ? { earnedAt: { gte: range.from, lte: range.to } } : {}) };
  }

  async recordTransfer(agencyId: string, ledgerId: string, transferReference: string) {
    return prisma.$transaction(async (tx) => {
      const ledger = await tx.guidePayoutLedger.findFirst({ where: { id: ledgerId, agencyId } });
      if (!ledger) throw AppError.notFound('Payout not found');
      if (ledger.status === 'TRANSFERRED') {
        if (ledger.transferReference === transferReference) return ledger;
        throw AppError.conflict('Payout was already transferred', 'PAYOUT_ALREADY_TRANSFERRED');
      }
      const updated = await tx.guidePayoutLedger.updateMany({ where: { id: ledgerId, agencyId, status: 'PENDING' }, data: { status: 'TRANSFERRED', transferredAt: new Date(), transferReference } });
      if (updated.count !== 1) throw AppError.conflict('Payout changed, reload and retry', 'CONCURRENT_UPDATE');
      await writeAudit(tx, { actorId: agencyId, actorRole: 'AGENCY', action: AUDIT_ACTIONS.GUIDE_PAYOUT_TRANSFERRED, targetType: 'guide-payout', targetId: ledgerId, metadata: { amount: ledger.amount, transferReference } });
      return tx.guidePayoutLedger.findUniqueOrThrow({ where: { id: ledgerId } });
    });
  }
}

export const earningsRepository = new EarningsRepository();
