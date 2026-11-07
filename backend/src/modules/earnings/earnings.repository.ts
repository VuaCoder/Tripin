import { prisma, type Prisma } from '../../config/database';
import type { GuidePayoutLedger as StoredPayout } from '../../generated/prisma/client';
import { writeAudit } from '../audit/audit.writer';
import { AUDIT_ACTIONS } from '../audit/audit.types';
import { AppError } from '../../utils/app-error';
import type { Earning as StoredEarning } from '../../generated/prisma/client';
import { numericRecord, type NumericRecord } from '../../utils/money';
import { safeVndNumber } from '@travel-platform/constants';
type Earning = NumericRecord<StoredEarning>;
import { toSkip, type PageRequest } from '../../utils/pagination';
import type { EarningsRange } from './earnings.types';

export type EarningRecord = Earning & { payout?: NumericRecord<StoredPayout> | null };

function toRecord(row: StoredEarning & { payout?: StoredPayout | null }): EarningRecord {
  return { ...numericRecord(row), payout: row.payout ? numericRecord(row.payout) : row.payout };
}

export type NewEarning = Omit<Earning, 'id' | 'createdAt'>;

export class EarningsRepository {
  create(data: NewEarning): Promise<EarningRecord> {
    return prisma.$transaction(async tx => {
      const earning = await tx.earning.create({ data });
      const payout = await tx.guidePayoutLedger.create({ data: { earningId: earning.id, guideId: data.guideId, agencyId: data.agencyId, tourId: data.tourId, amount: data.amount } });
      const tour = await tx.tour.findUnique({ where: { id: data.tourId }, select: { title: true } });
      await tx.premiumGuideActivity.create({ data: { userId: data.guideId, tourId: data.tourId, tourTitle: tour?.title ?? 'Tour', action: 'BOOKING_COMPLETED', bookingId: data.bookingId, occurredAt: data.earnedAt } });
      return toRecord({ ...earning, payout });
    });
  }

  async findByBookingId(bookingId: string): Promise<EarningRecord | null> {
    const row = await prisma.earning.findUnique({ where: { bookingId }, include: { payout: true } });
    return row ? toRecord(row) : null;
  }

  async listByGuide(guideId: string, range: EarningsRange, page: PageRequest) {
    const where = this.whereOf(guideId, range);
    const [items, total] = await Promise.all([
      prisma.earning.findMany({ where, include: { payout: true }, orderBy: [{ earnedAt: 'desc' }, { id: 'desc' }], skip: toSkip(page), take: page.limit }),
      prisma.earning.count({ where }),
    ]);
    return { items: items.map(toRecord), total };
  }

  /** Totals per calendar month (UTC) inside the range. */
  async summarize(guideId: string, range: EarningsRange): Promise<{ month: string; totalAmount: number; count: number }[]> {
    // Prisma DateTime is a timestamp WITHOUT time zone holding UTC values.
    // Group and compare in UTC, independent of the database session timezone.
    // Bind ISO text: Prisma's Date parameters carry a timestamp type, and
    // casting those to timestamptz would first apply the session timezone.
    const from = range.from?.toISOString() ?? null;
    const to = range.to?.toISOString() ?? null;
    const rows = await prisma.$queryRaw<{ month: string; totalAmount: string; count: number }[]>`
      SELECT to_char("earnedAt", 'YYYY-MM') AS "month",
             COALESCE(SUM("amount"), 0)::text AS "totalAmount", COUNT(*)::float8 AS "count"
      FROM "Earning"
      WHERE "guideId" = ${guideId}::uuid
        AND (${from}::timestamptz IS NULL OR "earnedAt" >= (${from}::timestamptz AT TIME ZONE 'UTC'))
        AND (${to}::timestamptz IS NULL OR "earnedAt" <= (${to}::timestamptz AT TIME ZONE 'UTC'))
      GROUP BY 1 ORDER BY 1 DESC`;
    return rows.map((row) => ({ ...row, totalAmount: safeVndNumber(row.totalAmount) }));
  }

  private whereOf(guideId: string, range: EarningsRange): Prisma.EarningWhereInput {
    return { guideId, ...(range.from || range.to ? { earnedAt: { gte: range.from, lte: range.to } } : {}) };
  }

  async recordTransfer(agencyId: string, ledgerId: string, transferReference: string) {
    return prisma.$transaction(async (tx) => {
      const ledger = await tx.guidePayoutLedger.findFirst({ where: { id: ledgerId, agencyId } });
      if (!ledger) throw AppError.notFound('Payout not found');
      if (ledger.status === 'TRANSFERRED') {
        if (ledger.transferReference === transferReference) return numericRecord(ledger);
        throw AppError.conflict('Payout was already transferred', 'PAYOUT_ALREADY_TRANSFERRED');
      }
      const updated = await tx.guidePayoutLedger.updateMany({ where: { id: ledgerId, agencyId, status: 'PENDING' }, data: { status: 'TRANSFERRED', transferredAt: new Date(), transferReference } });
      if (updated.count !== 1) throw AppError.conflict('Payout changed, reload and retry', 'CONCURRENT_UPDATE');
      await writeAudit(tx, { actorId: agencyId, actorRole: 'AGENCY', action: AUDIT_ACTIONS.GUIDE_PAYOUT_TRANSFERRED, targetType: 'guide-payout', targetId: ledgerId, metadata: { amount: safeVndNumber(ledger.amount), transferReference } });
      return numericRecord(await tx.guidePayoutLedger.findUniqueOrThrow({ where: { id: ledgerId } }));
    });
  }
}

export const earningsRepository = new EarningsRepository();
