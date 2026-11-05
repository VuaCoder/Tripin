import type { DateRange } from '../../utils/date-range';
import { BOOKING_STATUS, type BookingStatus, type PromotionScope } from '@travel-platform/constants';
import { nullIfNotFound, prisma, type DbExecutor, type Prisma } from '../../config/database';
import type { Booking as StoredBooking, PromotionRedemption as StoredRedemption } from '../../generated/prisma/client';
type PromotionRedemption = NumericRecord<StoredRedemption>;

import { numericRecord, type NumericRecord } from '../../utils/money';
import { safeVndNumber } from '@travel-platform/constants';
type Booking = NumericRecord<StoredBooking>;
import { toSkip, type PageRequest } from '../../utils/pagination';
import type { ListAgencyBookingsQuery, RevenueTotals } from './bookings.types';

export interface PromotionSnapshot {
  promotionId: string;
  code: string;
  scope: PromotionScope;
  discountAmount: number;
}

export interface PromotionRedemptionInput {
  promotionId: string;
  scope: PromotionScope;
  code: string;
  discountAmount: number;
  codeInstanceId?: string;
}

type FlattenedColumns = 'contactName' | 'contactPhone' | 'promotionId' | 'promotionCode' | 'promotionScope';

/** A stored booking; the contact and the applied-promotion snapshot are exposed as nested objects. */
export type BookingRecord = Omit<Booking, FlattenedColumns> & {
  contact: { fullName: string; phone: string };
  promotion?: PromotionSnapshot;
  redemptions?: PromotionRedemption[];
};

type BookingScalars = Omit<Booking, 'id' | 'createdAt' | 'updatedAt' | 'guestPricing' | FlattenedColumns> & { guestPricing: Prisma.InputJsonValue };

export type NewBooking = Pick<
  Booking,
  | 'bookingCode' | 'travelerId' | 'agencyId' | 'tourId' | 'departureId' | 'tourTitle' | 'departureDate' | 'endDate'
  | 'participants' | 'unitPrice' | 'subtotal' | 'totalAmount' | 'commissionBps' | 'commissionAmount' | 'agencyAmount'
> &
  Partial<BookingScalars> & { id?: string; contact: { fullName: string; phone: string }; promotion?: PromotionSnapshot; redemptions?: PromotionRedemptionInput[]; premiumVoucherToken?: string };


/** Plain-field changes (`null` clears a nullable column). */
export type BookingPatch = Partial<BookingScalars>;

function toRecord(stored: StoredBooking & { redemptions?: StoredRedemption[] }): BookingRecord {
  const row = numericRecord(stored);
  const { contactName, contactPhone, promotionId, promotionCode, promotionScope, redemptions, ...rest } = row;
  return {
    ...rest,
    contact: { fullName: contactName, phone: contactPhone },
    promotion:
      promotionId && promotionCode && promotionScope
        ? { promotionId, code: promotionCode, scope: promotionScope, discountAmount: row.discountAmount }
        : undefined,
    ...(redemptions ? { redemptions: redemptions.map(numericRecord) } : {}),
  };
}

const PAID = { in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.COMPLETED] };
const NEWEST_FIRST: Prisma.BookingOrderByWithRelationInput[] = [{ createdAt: 'desc' }, { id: 'desc' }];

export class BookingsRepository {
  async create(data: NewBooking, db: DbExecutor = prisma): Promise<BookingRecord> {
    // Standalone callers need the same atomic claim as the booking transaction path.
    if (data.premiumVoucherId && db === prisma) {
      return prisma.$transaction((tx) => this.create(data, tx));
    }
    const { contact, promotion, redemptions, premiumVoucherToken, ...scalars } = data;
    const row = await db.booking.create({

      data: {
        ...scalars,
        contactName: contact.fullName,
        contactPhone: contact.phone,
        ...(promotion
          ? { promotionId: promotion.promotionId, promotionCode: promotion.code, promotionScope: promotion.scope, discountAmount: promotion.discountAmount }
          : {}),
        ...(redemptions && redemptions.length > 0
          ? {
              redemptions: {
                create: redemptions.map((r) => ({
                  promotionId: r.promotionId,
                  scope: r.scope,
                  code: r.code,
                  discountAmount: r.discountAmount,
                  codeInstanceId: r.codeInstanceId,
                })),
              },
            }
          : {}),
      },
      include: { redemptions: true },
    });
    if (data.premiumVoucherId) {
      const claimed = await db.premiumVoucher.updateMany({
        where: { id: data.premiumVoucherId, userId: data.travelerId, leaseToken: premiumVoucherToken, bookingId: null, endsAt: { gt: new Date() } },
        data: { bookingId: row.id },
      });
      if (claimed.count !== 1) throw new Error('Premium voucher lease lost');
    }
    return toRecord(row);
  }

  async findById(id: string): Promise<BookingRecord | null> {
    const row = await prisma.booking.findUnique({ where: { id }, include: { redemptions: true } });
    return row ? toRecord(row) : null;
  }

  async findRedemptions(bookingId: string, db: DbExecutor = prisma): Promise<PromotionRedemption[]> {
    return (await db.promotionRedemption.findMany({ where: { bookingId } })).map(numericRecord);
  }

  async findByRequestId(travelerId: string, clientRequestId: string, db: DbExecutor = prisma): Promise<BookingRecord | null> {
    const row = await db.booking.findUnique({ where: { travelerId_clientRequestId: { travelerId, clientRequestId } }, include: { redemptions: true } });

    return row ? toRecord(row) : null;
  }

  /** Compare-and-set on status: returns null when the booking is no longer in one of the expected statuses. */
  async transition(id: string, expected: readonly BookingStatus[], patch: BookingPatch, db: DbExecutor = prisma): Promise<BookingRecord | null> {
    const row = await db.booking.update({ where: { id, status: { in: [...expected] } }, data: patch }).catch(nullIfNotFound);
    return row ? toRecord(row) : null;
  }

  async updateById(id: string, patch: BookingPatch): Promise<BookingRecord | null> {
    const row = await prisma.booking.update({ where: { id }, data: patch }).catch(nullIfNotFound);
    return row ? toRecord(row) : null;
  }

  listByTraveler(travelerId: string, status: BookingStatus | undefined, page: PageRequest) {
    return this.paginate({ travelerId, ...(status ? { status } : {}) }, NEWEST_FIRST, page);
  }

  async countByTraveler(travelerId: string, db: DbExecutor = prisma): Promise<number> {
    return db.booking.count({ where: { travelerId, status: { not: 'CANCELLED' } } });
  }

  listByAgency(agencyId: string, query: ListAgencyBookingsQuery) {
    const where: Prisma.BookingWhereInput = { agencyId };
    if (query.status) where.status = query.status;
    if (query.tourId) where.tourId = query.tourId;
    if (query.departureFrom || query.departureTo) where.departureDate = { gte: query.departureFrom, lte: query.departureTo };
    return this.paginate(where, NEWEST_FIRST, query);
  }

  /** PENDING bookings whose payment window has passed. */
  async findExpiredPending(now: Date, limit: number): Promise<BookingRecord[]> {
    const rows = await prisma.booking.findMany({ where: { status: BOOKING_STATUS.PENDING, paymentExpiresAt: { lt: now } }, take: limit });
    return rows.map(toRecord);
  }

  /** CONFIRMED bookings whose tour has ended. */
  async findDueForCompletion(now: Date, limit: number): Promise<BookingRecord[]> {
    const rows = await prisma.booking.findMany({ where: { status: BOOKING_STATUS.CONFIRMED, endDate: { lt: now } }, take: limit });
    return rows.map(toRecord);
  }

  /** Paid bookings of one tour of one agency, optionally one departure, in departure order (capped). */
  async listPaidForTour(agencyId: string, tourId: string, departureId: string | undefined, limit: number): Promise<BookingRecord[]> {
    const rows = await prisma.booking.findMany({
      where: { agencyId, tourId, status: PAID, ...(departureId ? { departureId } : {}) },
      orderBy: [{ departureDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    return rows.map(toRecord);
  }

  // ---- dashboard read models (paid = CONFIRMED + COMPLETED)

  /** Unique travelers with a confirmed/completed booking belonging to this agency. */
  async customerCount(agencyId: string): Promise<number> {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(DISTINCT "travelerId")::float8 AS "count" FROM "Booking"
      WHERE "agencyId" = ${agencyId}::uuid AND "status" IN ('CONFIRMED', 'COMPLETED')`;
    return rows[0]?.count ?? 0;
  }

  async statusCounts(agencyId?: string, range?: DateRange): Promise<Record<string, number>> {
    const rows = await prisma.booking.groupBy({ by: ['status'], where: { ...(agencyId ? { agencyId } : {}), ...(range ? { createdAt: { gte: range.from, lte: range.to } } : {}) }, _count: { _all: true } });
    return Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
  }

  async revenueTotals(agencyId?: string, range?: DateRange): Promise<RevenueTotals> {
    const total = await prisma.booking.aggregate({
      where: { status: PAID, ...(agencyId ? { agencyId } : {}), ...(range ? { confirmedAt: { gte: range.from, lte: range.to } } : {}) },
      _count: { _all: true },
      _sum: { totalAmount: true, commissionAmount: true, agencyAmount: true },
    });
    return {
      bookings: total._count._all,
      gross: safeVndNumber(total._sum.totalAmount ?? 0n),
      commission: safeVndNumber(total._sum.commissionAmount ?? 0n),
      net: safeVndNumber(total._sum.agencyAmount ?? 0n),
    };
  }

  async dailyNet(agencyId: string, since: Date, until = new Date()): Promise<{ date: string; bookings: number; net: number }[]> {
    const rows = await prisma.$queryRaw<{ date: string; bookings: number; net: string }[]>`
      SELECT to_char("confirmedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS "date",
             COUNT(*)::float8 AS "bookings", COALESCE(SUM("agencyAmount"), 0)::text AS "net"
      FROM "Booking"
      WHERE "agencyId" = ${agencyId}::uuid AND "status" IN ('CONFIRMED', 'COMPLETED') AND "confirmedAt" >= ${since} AND "confirmedAt" <= ${until}
      GROUP BY 1 ORDER BY 1`;
    return rows.map((row) => ({ ...row, net: safeVndNumber(row.net) }));
  }

  async monthlyTotals(since: Date, until?: Date): Promise<{ month: string; bookings: number; gross: number; commission: number }[]> {
    const rows = await prisma.$queryRaw<{ month: string; bookings: number; gross: string; commission: string }[]>`
      SELECT to_char("confirmedAt", 'YYYY-MM') AS "month",
             COUNT(*)::float8 AS "bookings", COALESCE(SUM("totalAmount"), 0)::text AS "gross",
             COALESCE(SUM("commissionAmount"), 0)::text AS "commission"
      FROM "Booking"
      WHERE "status" IN ('CONFIRMED', 'COMPLETED') AND "confirmedAt" >= ${since}
        AND (${until ?? null}::timestamp IS NULL OR "confirmedAt" <= ${until ?? null})
      GROUP BY 1 ORDER BY 1`;
    return rows.map((row) => ({ ...row, gross: safeVndNumber(row.gross), commission: safeVndNumber(row.commission) }));
  }

  async topTours(agencyId: string, limit: number): Promise<{ tourId: string; title: string; coverImage: string | null; bookings: number; net: number }[]> {
    const rows = await prisma.$queryRaw<{ tourId: string; title: string; coverImage: string | null; bookings: number; net: string }[]>`
      SELECT "tourId"::text AS "tourId", (ARRAY_AGG("tourTitle" ORDER BY "createdAt" DESC))[1] AS "title",
             (SELECT "images"[1] FROM "Tour" WHERE "Tour"."id" = "Booking"."tourId" AND "Tour"."agencyId" = ${agencyId}::uuid) AS "coverImage",
             COUNT(*)::float8 AS "bookings", COALESCE(SUM("agencyAmount"), 0)::text AS "net"
      FROM "Booking"
      WHERE "agencyId" = ${agencyId}::uuid AND "status" IN ('CONFIRMED', 'COMPLETED')
      GROUP BY "tourId" ORDER BY COALESCE(SUM("agencyAmount"), 0) DESC, "bookings" DESC LIMIT ${limit}`;
    return rows.map((row) => ({ ...row, net: safeVndNumber(row.net) }));
  }

  private async paginate(where: Prisma.BookingWhereInput, orderBy: Prisma.BookingOrderByWithRelationInput[], page: PageRequest) {
    const [rows, total] = await Promise.all([
      prisma.booking.findMany({ where, orderBy, skip: toSkip(page), take: page.limit }),
      prisma.booking.count({ where }),
    ]);
    return { items: rows.map(toRecord), total };
  }
}

export const bookingsRepository = new BookingsRepository();
