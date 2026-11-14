import type { DateRange } from '../../utils/date-range';
import { BOOKING_STATUS, type BookingStatus, type PromotionScope } from '@travel-platform/constants';
import { nullIfNotFound, prisma, type DbExecutor, type Prisma } from '../../config/database';
import type { Booking as StoredBooking, PromotionRedemption as StoredRedemption } from '../../generated/prisma/client';
type PromotionRedemption = NumericRecord<StoredRedemption>;

import { numericRecord, type NumericRecord } from '../../utils/money';
import { safeVndNumber } from '@travel-platform/constants';
type Booking = NumericRecord<StoredBooking>;
import { toSkip, type PageRequest } from '../../utils/pagination';
import type { BookingPassengerDto, ListAgencyBookingsQuery, RevenueTotals } from './bookings.types';

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

export interface BookingReviewSnapshot {
  id: string;
  rating: number;
  comment: string;
  images: string[];
  createdAt: string;
}

/** A stored booking; the contact and the applied-promotion snapshot are exposed as nested objects. */
export type BookingRecord = Omit<Booking, FlattenedColumns> & {
  contact: { fullName: string; phone: string };
  promotion?: PromotionSnapshot;
  redemptions?: PromotionRedemption[];
  /** Named members of a group booking, filled only by `findById`. */
  passengers?: BookingPassengerDto[];
  /** The tour's gallery, filled only by the traveler list query (no Tour relation on Booking). */
  tourImages?: string[];
  review?: BookingReviewSnapshot;
};

type BookingScalars = Omit<Booking, 'id' | 'createdAt' | 'updatedAt' | 'guestPricing' | 'passengerSnapshot' | 'cancellationPolicySnapshot' | FlattenedColumns> & { guestPricing: Prisma.InputJsonValue; passengerSnapshot: Prisma.InputJsonValue; cancellationPolicySnapshot: Prisma.InputJsonValue };

export type NewBooking = Pick<
  Booking,
  | 'bookingCode' | 'travelerId' | 'agencyId' | 'tourId' | 'departureId' | 'tourTitle' | 'departureDate' | 'endDate'
  | 'participants' | 'unitPrice' | 'subtotal' | 'totalAmount' | 'commissionBps' | 'commissionAmount' | 'agencyAmount'
> &
  Partial<BookingScalars> & {
    id?: string;
    contact: { fullName: string; phone: string };
    promotion?: PromotionSnapshot;
    redemptions?: PromotionRedemptionInput[];
    premiumVoucherToken?: string;
    passengers?: BookingPassengerDto[];
  };


/** Plain-field changes (`null` clears a nullable column). */
export type BookingPatch = Partial<BookingScalars>;

function toRecord(stored: StoredBooking & { redemptions?: StoredRedemption[]; passengers?: BookingPassengerDto[] }): BookingRecord {
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
    const { contact, promotion, redemptions, premiumVoucherToken, passengers, ...scalars } = data;
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
        ...(passengers && passengers.length > 0 ? { passengers: { create: passengers } } : {}),
      },
      include: { redemptions: true, passengers: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
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
    const row = await prisma.booking.findUnique({
      where: { id },
      include: { redemptions: true, passengers: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
    });
    if (!row) return null;
    const [tour, review] = await Promise.all([
      prisma.tour.findUnique({
        where: { id: row.tourId },
        select: { images: true },
      }),
      prisma.review.findUnique({
        where: { bookingId: id },
        select: { id: true, rating: true, comment: true, images: true, createdAt: true },
      }),
    ]);
    return {
      ...toRecord(row),
      tourImages: tour?.images ?? [],
      review: review
        ? {
            id: review.id,
            rating: review.rating,
            comment: review.comment,
            images: review.images,
            createdAt: review.createdAt.toISOString(),
          }
        : undefined,
    };
  }

  async findRedemptions(bookingId: string, db: DbExecutor = prisma): Promise<PromotionRedemption[]> {
    return (await db.promotionRedemption.findMany({ where: { bookingId } })).map(numericRecord);
  }

  async findByRequestId(travelerId: string, clientRequestId: string, db: DbExecutor = prisma): Promise<BookingRecord | null> {
    const row = await db.booking.findUnique({ where: { travelerId_clientRequestId: { travelerId, clientRequestId } }, include: { redemptions: true } });

    return row ? toRecord(row) : null;
  }

  /**
   * The live booking of a group-booking request: PENDING, paid, or already completed. A cancelled/expired one is
   * deliberately not returned, so the same request can be booked again.
   */
  async findActiveByCustomTourRequest(requestId: string): Promise<BookingRecord | null> {
    const row = await prisma.booking.findFirst({
      where: {
        customTourRequestId: requestId,
        status: { in: [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.COMPLETED] },
      },
      orderBy: NEWEST_FIRST,
      include: { redemptions: true },
    });
    return row ? toRecord(row) : null;
  }

  /** The same live-booking filter for a page of requests: one query, newest row per request kept by the caller. */
  findActiveByCustomTourRequests(requestIds: string[]): Promise<{ id: string; customTourRequestId: string | null; status: string; bookingCode: string; isPaid: boolean }[]> {
    if (requestIds.length === 0) return Promise.resolve([]);
    return prisma.booking.findMany({
      where: {
        customTourRequestId: { in: requestIds },
        status: { in: [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.COMPLETED] },
      },
      orderBy: NEWEST_FIRST,
      select: { id: true, customTourRequestId: true, status: true, bookingCode: true, isPaid: true },
    });
  }

  /** Serialize the pending-booking check for this traveler/departure without a schema change. */
  async lockPendingDeparture(travelerId: string, departureId: string, db: DbExecutor): Promise<void> {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('booking-pending'), hashtext(${`${travelerId}:${departureId}`}))`;
  }

  findPendingForDeparture(travelerId: string, tourId: string, departureId: string, db: DbExecutor = prisma) {
    return db.booking.findFirst({
      where: { travelerId, tourId, departureId, status: BOOKING_STATUS.PENDING },
      orderBy: { createdAt: 'desc' },
      select: { id: true, bookingCode: true },
    });
  }

  /** Compare-and-set on status: returns null when the booking is no longer in one of the expected statuses. */
  async transition(id: string, expected: readonly BookingStatus[], patch: BookingPatch, db: DbExecutor = prisma): Promise<BookingRecord | null> {
    // Reuse the caller's transaction for voucher/refund changes; standalone calls need the same atomic boundary.
    if (db === prisma) return prisma.$transaction(tx => this.transition(id, expected, patch, tx));
    const row = await (async () => {
      const updated = await db.booking.update({
        where: { id, status: { in: [...expected] }, ...(patch.status === BOOKING_STATUS.COMPLETED ? { endDate: { lte: new Date() } } : {}) },
        data: patch,
      });
      if (patch.status === BOOKING_STATUS.CANCELLED) {
        await db.eTicket.updateMany({ where: { bookingId: id, status: 'VALID' }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
      }
      return updated;
    })().catch(nullIfNotFound);
    return row ? toRecord(row) : null;
  }

  /**
   * Atomically cancel a booking and restore inventory (seats + promotion + premium voucher) in one DB transaction
   * so a mid-flight network failure cannot leave seats/vouchers stuck after status already flipped (PAY-002).
   */
  async cancelWithInventoryRelease(input: {
    id: string;
    expected: readonly BookingStatus[];
    patch: BookingPatch;
    tourId: string;
    departureId: string;
    seats: number;
    promotionId?: string;
    releasePremiumVoucher: boolean;
  }): Promise<BookingRecord | null> {
    return prisma.$transaction(async (tx) => {
      const row = await tx.booking
        .update({ where: { id: input.id, status: { in: [...input.expected] } }, data: input.patch })
        .catch(nullIfNotFound);
      if (!row) return null;

      await tx.eTicket.updateMany({ where: { bookingId: input.id, status: 'VALID' }, data: { status: 'CANCELLED', cancelledAt: new Date() } });

      await tx.$executeRaw`
        UPDATE "TourDeparture" SET "remaining" = LEAST("capacity", "remaining" + ${input.seats})
        WHERE "id" = ${input.departureId}::uuid AND "tourId" = ${input.tourId}::uuid`;

      if (input.promotionId) {
        await tx.promotion.updateMany({
          where: { id: input.promotionId, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
      }

      if (input.releasePremiumVoucher) {
        await tx.premiumVoucher.updateMany({
          where: { bookingId: input.id },
          data: { bookingId: null, heldAt: null, leaseToken: null },
        });
      }

      return toRecord(row);
    });
  }

  async updateById(id: string, patch: BookingPatch): Promise<BookingRecord | null> {
    const row = await prisma.booking.update({ where: { id }, data: patch }).catch(nullIfNotFound);
    return row ? toRecord(row) : null;
  }

  listByTraveler(travelerId: string, status: BookingStatus | undefined, page: PageRequest) {
    return this.paginate({ travelerId, ...(status ? { status } : {}) }, NEWEST_FIRST, page, { withTourImages: true });
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
    const rows = await prisma.booking.findMany({ where: { status: BOOKING_STATUS.CONFIRMED, endDate: { lte: now } }, take: limit });
    return rows.map(toRecord);
  }

  /** Paid bookings of one tour of one agency, optionally one departure, in departure order (capped). */
  async listPaidForTour(agencyId: string, tourId: string, departureId: string | undefined, limit: number): Promise<BookingRecord[]> {
    const rows = await prisma.booking.findMany({
      where: { agencyId, tourId, status: PAID, ...(departureId ? { departureId } : {}) },
      orderBy: [{ departureDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      take: limit,
      include: { passengers: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
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

  private async paginate(
    where: Prisma.BookingWhereInput,
    orderBy: Prisma.BookingOrderByWithRelationInput[],
    page: PageRequest,
    options: { withTourImages?: boolean } = {},
  ) {
    const [rows, total] = await Promise.all([
      prisma.booking.findMany({ where, orderBy, skip: toSkip(page), take: page.limit }),
      prisma.booking.count({ where }),
    ]);
    const items = rows.map(toRecord);
    if (!options.withTourImages || !items.length) return { items, total };
    // Booking has no Tour relation, so the card cover is fetched in one extra query for this page only.
    const tours = await prisma.tour.findMany({
      where: { id: { in: Array.from(new Set(items.map(row => row.tourId))) } },
      select: { id: true, images: true },
    });
    const covers = new Map(tours.map(tour => [tour.id, tour.images]));
    return { items: items.map(row => ({ ...row, tourImages: covers.get(row.tourId) ?? [] })), total };
  }
}

export const bookingsRepository = new BookingsRepository();
