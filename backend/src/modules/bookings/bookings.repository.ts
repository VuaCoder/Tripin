import { BOOKING_STATUS, type BookingStatus, type PromotionScope } from '@travel-platform/constants';
import { nullIfNotFound, prisma, type Prisma } from '../../config/database';
import type { Booking } from '../../generated/prisma/client';
import { toSkip, type PageRequest } from '../../utils/pagination';
import type { ListAgencyBookingsQuery, RevenueTotals } from './bookings.types';

export interface PromotionSnapshot {
  promotionId: string;
  code: string;
  scope: PromotionScope;
  discountAmount: number;
}

type FlattenedColumns = 'contactName' | 'contactPhone' | 'promotionId' | 'promotionCode' | 'promotionScope';

/** A stored booking; the contact and the applied-promotion snapshot are exposed as nested objects. */
export type BookingRecord = Omit<Booking, FlattenedColumns> & {
  contact: { fullName: string; phone: string };
  promotion?: PromotionSnapshot;
};

type BookingScalars = Omit<Booking, 'id' | 'createdAt' | 'updatedAt' | FlattenedColumns>;

export type NewBooking = Pick<
  Booking,
  | 'bookingCode' | 'travelerId' | 'agencyId' | 'tourId' | 'departureId' | 'tourTitle' | 'departureDate' | 'endDate'
  | 'participants' | 'unitPrice' | 'subtotal' | 'totalAmount' | 'commissionBps' | 'commissionAmount' | 'agencyAmount'
> &
  Partial<BookingScalars> & { contact: { fullName: string; phone: string }; promotion?: PromotionSnapshot };

/** Plain-field changes (`null` clears a nullable column). */
export type BookingPatch = Partial<BookingScalars>;

function toRecord(row: Booking): BookingRecord {
  const { contactName, contactPhone, promotionId, promotionCode, promotionScope, ...rest } = row;
  return {
    ...rest,
    contact: { fullName: contactName, phone: contactPhone },
    promotion:
      promotionId && promotionCode && promotionScope
        ? { promotionId, code: promotionCode, scope: promotionScope, discountAmount: row.discountAmount }
        : undefined,
  };
}

const PAID = { in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.COMPLETED] };
const NEWEST_FIRST: Prisma.BookingOrderByWithRelationInput[] = [{ createdAt: 'desc' }, { id: 'desc' }];

export class BookingsRepository {
  async create(data: NewBooking): Promise<BookingRecord> {
    const { contact, promotion, ...scalars } = data;
    const row = await prisma.booking.create({
      data: {
        ...scalars,
        contactName: contact.fullName,
        contactPhone: contact.phone,
        ...(promotion
          ? { promotionId: promotion.promotionId, promotionCode: promotion.code, promotionScope: promotion.scope, discountAmount: promotion.discountAmount }
          : {}),
      },
    });
    return toRecord(row);
  }

  async findById(id: string): Promise<BookingRecord | null> {
    const row = await prisma.booking.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async findByRequestId(travelerId: string, clientRequestId: string): Promise<BookingRecord | null> {
    const row = await prisma.booking.findUnique({ where: { travelerId_clientRequestId: { travelerId, clientRequestId } } });
    return row ? toRecord(row) : null;
  }

  /** Compare-and-set on status: returns null when the booking is no longer in one of the expected statuses. */
  async transition(id: string, expected: readonly BookingStatus[], patch: BookingPatch): Promise<BookingRecord | null> {
    const row = await prisma.booking.update({ where: { id, status: { in: [...expected] } }, data: patch }).catch(nullIfNotFound);
    return row ? toRecord(row) : null;
  }

  async updateById(id: string, patch: BookingPatch): Promise<BookingRecord | null> {
    const row = await prisma.booking.update({ where: { id }, data: patch }).catch(nullIfNotFound);
    return row ? toRecord(row) : null;
  }

  listByTraveler(travelerId: string, status: BookingStatus | undefined, page: PageRequest) {
    return this.paginate({ travelerId, ...(status ? { status } : {}) }, NEWEST_FIRST, page);
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

  async statusCounts(agencyId?: string): Promise<Record<string, number>> {
    const rows = await prisma.booking.groupBy({ by: ['status'], where: agencyId ? { agencyId } : {}, _count: { _all: true } });
    return Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
  }

  async revenueTotals(agencyId?: string): Promise<RevenueTotals> {
    const total = await prisma.booking.aggregate({
      where: { status: PAID, ...(agencyId ? { agencyId } : {}) },
      _count: { _all: true },
      _sum: { totalAmount: true, commissionAmount: true, agencyAmount: true },
    });
    return {
      bookings: total._count._all,
      gross: total._sum.totalAmount ?? 0,
      commission: total._sum.commissionAmount ?? 0,
      net: total._sum.agencyAmount ?? 0,
    };
  }

  async dailyNet(agencyId: string, since: Date): Promise<{ date: string; bookings: number; net: number }[]> {
    return prisma.$queryRaw<{ date: string; bookings: number; net: number }[]>`
      SELECT to_char("confirmedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS "date",
             COUNT(*)::float8 AS "bookings", COALESCE(SUM("agencyAmount"), 0)::float8 AS "net"
      FROM "Booking"
      WHERE "agencyId" = ${agencyId}::uuid AND "status" IN ('CONFIRMED', 'COMPLETED') AND "confirmedAt" >= ${since}
      GROUP BY 1 ORDER BY 1`;
  }

  async monthlyTotals(since: Date): Promise<{ month: string; bookings: number; gross: number; commission: number }[]> {
    return prisma.$queryRaw<{ month: string; bookings: number; gross: number; commission: number }[]>`
      SELECT to_char("confirmedAt" AT TIME ZONE 'UTC', 'YYYY-MM') AS "month",
             COUNT(*)::float8 AS "bookings", COALESCE(SUM("totalAmount"), 0)::float8 AS "gross",
             COALESCE(SUM("commissionAmount"), 0)::float8 AS "commission"
      FROM "Booking"
      WHERE "status" IN ('CONFIRMED', 'COMPLETED') AND "confirmedAt" >= ${since}
      GROUP BY 1 ORDER BY 1`;
  }

  async topTours(agencyId: string, limit: number): Promise<{ tourId: string; title: string; bookings: number; net: number }[]> {
    return prisma.$queryRaw<{ tourId: string; title: string; bookings: number; net: number }[]>`
      SELECT "tourId"::text AS "tourId", (ARRAY_AGG("tourTitle" ORDER BY "createdAt" DESC))[1] AS "title",
             COUNT(*)::float8 AS "bookings", COALESCE(SUM("agencyAmount"), 0)::float8 AS "net"
      FROM "Booking"
      WHERE "agencyId" = ${agencyId}::uuid AND "status" IN ('CONFIRMED', 'COMPLETED')
      GROUP BY "tourId" ORDER BY "net" DESC, "bookings" DESC LIMIT ${limit}`;
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
