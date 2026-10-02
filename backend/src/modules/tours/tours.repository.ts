import { TOUR_STATUS, type TourStatus } from '@travel-platform/constants';
import { nullIfNotFound, prisma, type DbExecutor, type Prisma } from '../../config/database';
import type { GuideAssignmentStatus, Tour, TourDeparture, TourGuideAssignment } from '../../generated/prisma/client';
import { toSkip, type PageRequest } from '../../utils/pagination';
import { containsText } from '../../utils/search';
import type { ListTourFilter, SearchToursQuery, TourSort } from './tours.types';

export interface StoredItineraryDay {
  day: number;
  title: string;
  description?: string | null;
  activities: string[];
}

export type DepartureRecord = TourDeparture;
export type GuideAssignmentRecord = TourGuideAssignment;

/** A stored tour with its categories (ids), departures and guide assignment flattened onto one object. */
export type TourRecord = Omit<Tour, 'itinerary'> & {
  itinerary: StoredItineraryDay[];
  categoryIds: string[];
  departures: DepartureRecord[];
  guide?: GuideAssignmentRecord;
};

export type GuideAssignmentFields = Partial<Omit<GuideAssignmentRecord, 'tourId'>> & Pick<GuideAssignmentRecord, 'guideId' | 'feePerBooking'>;

type TourScalars = Omit<Tour, 'id' | 'agencyId' | 'createdAt' | 'updatedAt' | 'itinerary'>;

export type NewDeparture = Pick<DepartureRecord, 'date' | 'capacity' | 'remaining'> & Partial<Pick<DepartureRecord, 'priceOverride' | 'isOpen'>>;

export type NewTour = Pick<Tour, 'agencyId' | 'title' | 'destination' | 'durationDays' | 'basePrice'> &
  Partial<TourScalars> & { itinerary?: StoredItineraryDay[]; categoryIds?: string[]; departures?: NewDeparture[]; guide?: GuideAssignmentFields };

/** Changes to a tour. `categoryIds` replaces the category set; `guide: null` removes the assignment. */
export type TourPatch = Partial<TourScalars> & { itinerary?: StoredItineraryDay[]; categoryIds?: string[]; guide?: GuideAssignmentFields | null };

/** One step of `applyDepartures` (see below). */
export type DepartureChange =
  | { kind: 'create'; data: NewDeparture }
  | {
      kind: 'update';
      id: string;
      /** What the caller read: the update is refused when the stored capacity (and, when `lockSeats`, remaining) differs. */
      expectedCapacity: number;
      expectedRemaining: number;
      capacity: number;
      date: Date;
      priceOverride: number | null;
      isOpen: boolean;
      /** The date moves: only valid while no seat was sold since the caller read the departure. */
      lockSeats: boolean;
    }
  | { kind: 'delete'; id: string };

const include = {
  categories: { select: { id: true } },
  departures: { orderBy: { date: 'asc' } },
  guideAssignment: true,
} satisfies Prisma.TourInclude;

type Row = Prisma.TourGetPayload<{ include: typeof include }>;

function toRecord(row: Row): TourRecord {
  const { categories, guideAssignment, itinerary, ...tour } = row;
  return { ...tour, itinerary: itinerary as unknown as StoredItineraryDay[], categoryIds: categories.map((c) => c.id), guide: guideAssignment ?? undefined };
}

const toRecords = (rows: Row[]): TourRecord[] => rows.map(toRecord);

const SORTS: Record<TourSort, Prisma.TourOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }, { id: 'desc' }],
  price_asc: [{ basePrice: 'asc' }, { id: 'asc' }],
  price_desc: [{ basePrice: 'desc' }, { id: 'desc' }],
  rating: [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }, { id: 'desc' }],
};

function writeData(patch: TourPatch): Prisma.TourUncheckedUpdateInput {
  const { categoryIds, guide, itinerary, ...scalars } = patch;
  return {
    ...scalars,
    ...(itinerary ? { itinerary: itinerary as unknown as Prisma.InputJsonValue } : {}),
    ...(categoryIds ? { categories: { set: categoryIds.map((id) => ({ id })) } } : {}),
    ...(guide ? { guideAssignment: { upsert: { create: guide, update: guide } } } : {}),
  };
}

/** All database access of the tours domain. */
export class ToursRepository {
  async create(data: NewTour): Promise<TourRecord> {
    return toRecord(await createOne(prisma, data));
  }

  /** All-or-nothing bulk insert. */
  insertMany(data: NewTour[]): Promise<TourRecord[]> {
    return prisma.$transaction(async (tx) => {
      const rows: Row[] = [];
      for (const item of data) rows.push(await createOne(tx, item));
      return toRecords(rows);
    });
  }

  async findById(id: string): Promise<TourRecord | null> {
    const row = await prisma.tour.findUnique({ where: { id }, include });
    return row ? toRecord(row) : null;
  }

  async findManyByIds(ids: string[]): Promise<TourRecord[]> {
    return toRecords(await prisma.tour.findMany({ where: { id: { in: ids } }, include }));
  }

  /** Compare-and-set on status so a concurrent moderator decision / agency edit cannot be overwritten. */
  async updateIfStatus(id: string, expected: readonly TourStatus[], patch: TourPatch): Promise<TourRecord | null> {
    try {
      return await prisma.$transaction(async (tx) => {
        // Removing the assignment happens first; if the status guard below fails (P2025) the whole transaction rolls back.
        if (patch.guide === null) await tx.tourGuideAssignment.deleteMany({ where: { tourId: id } });
        return toRecord(await tx.tour.update({ where: { id, status: { in: [...expected] } }, data: writeData(patch), include }));
      });
    } catch (error) {
      return nullIfNotFound(error);
    }
  }

  /** Updates a pending guide assignment atomically (guide answers only their own PENDING assignment). */
  async answerGuideAssignment(
    tourId: string,
    guideId: string,
    answer: { status: GuideAssignmentStatus; respondedAt: Date; note?: string },
  ): Promise<TourRecord | null> {
    const result = await prisma.tourGuideAssignment.updateMany({
      where: { tourId, guideId, status: 'PENDING', tour: { is: { status: { not: TOUR_STATUS.ARCHIVED } } } },
      data: answer,
    });
    return result.count === 1 ? this.findById(tourId) : null;
  }

  // ------------------------------------------------------- discovery

  async searchPublic(query: SearchToursQuery): Promise<{ items: TourRecord[]; total: number }> {
    const where: Prisma.TourWhereInput = { status: TOUR_STATUS.APPROVED };
    const and: Prisma.TourWhereInput[] = [];
    if (query.q) and.push({ OR: [{ title: containsText(query.q) }, { destination: containsText(query.q) }, { summary: containsText(query.q) }] });
    if (query.destination) and.push({ destination: containsText(query.destination) });
    if (query.categoryId) and.push({ categories: { some: { id: query.categoryId } } });
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      and.push({ basePrice: { gte: query.minPrice, lte: query.maxPrice } });
    }
    if (query.minDays !== undefined || query.maxDays !== undefined) {
      and.push({ durationDays: { gte: query.minDays, lte: query.maxDays } });
    }
    if (query.minRating !== undefined) and.push({ ratingAvg: { gte: query.minRating } });
    if (query.departureFrom || query.departureTo) {
      // Only departures that can still be booked count for the date filter.
      const now = new Date();
      const from = query.departureFrom && query.departureFrom > now ? query.departureFrom : now;
      and.push({ departures: { some: { isOpen: true, remaining: { gt: 0 }, date: { gte: from, lte: query.departureTo } } } });
    }
    return this.paginate({ ...where, AND: and }, SORTS[query.sort], query);
  }

  listByAgency(agencyId: string, status: TourStatus | undefined, page: PageRequest) {
    return this.paginate({ agencyId, status: status ?? { not: TOUR_STATUS.ARCHIVED } }, [{ updatedAt: 'desc' }, { id: 'desc' }], page);
  }

  listByGuide(guideId: string, page: PageRequest) {
    return this.paginate(
      { guideAssignment: { is: { guideId } }, status: { not: TOUR_STATUS.ARCHIVED } },
      [{ updatedAt: 'desc' }, { id: 'desc' }],
      page,
    );
  }

  /** Moderator list: every status (ARCHIVED excluded unless asked for). */
  listForModeration(filter: ListTourFilter, page: PageRequest) {
    const where: Prisma.TourWhereInput = { status: filter.status ?? { not: TOUR_STATUS.ARCHIVED } };
    if (filter.agencyId) where.agencyId = filter.agencyId;
    if (filter.q) where.OR = [{ title: containsText(filter.q) }, { destination: containsText(filter.q) }];
    return this.paginate(where, [{ submittedAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }], page);
  }

  /** Tours per status, for one agency or (no argument) the whole platform. */
  async countByStatus(agencyId?: string): Promise<{ status: TourStatus; count: number }[]> {
    const rows = await prisma.tour.groupBy({ by: ['status'], where: agencyId ? { agencyId } : {}, _count: { _all: true } });
    return rows.map((row) => ({ status: row.status, count: row._count._all }));
  }

  // ------------------------------------------------------ inventory

  /**
   * Atomically takes `seats` from an open, future departure of an APPROVED tour.
   * Returns false when the departure is missing/closed/past/sold out — never oversells.
   */
  async reserveSeats(tourId: string, departureId: string, seats: number): Promise<boolean> {
    const result = await prisma.tourDeparture.updateMany({
      where: {
        id: departureId,
        tourId,
        isOpen: true,
        date: { gt: new Date() },
        remaining: { gte: seats },
        tour: { is: { status: TOUR_STATUS.APPROVED } },
      },
      data: { remaining: { decrement: seats } },
    });
    return result.count === 1;
  }

  /** Gives seats back (booking cancelled / payment expired). Never exceeds capacity. */
  async releaseSeats(tourId: string, departureId: string, seats: number): Promise<void> {
    await prisma.$executeRaw`
      UPDATE "TourDeparture" SET "remaining" = LEAST("capacity", "remaining" + ${seats})
      WHERE "id" = ${departureId}::uuid AND "tourId" = ${tourId}::uuid`;
  }

  /**
   * Applies departure edits in one transaction. Every change is guarded against seats sold meanwhile (capacity is
   * adjusted by a delta, never overwritten), so an availability edit can never wipe out a booking.
   * Returns null when a guard fails (the caller reports a conflict); nothing is written then.
   */
  async applyDepartures(tourId: string, changes: DepartureChange[]): Promise<TourRecord | null> {
    const conflict = Symbol('conflict');
    try {
      await prisma.$transaction(async (tx) => {
        for (const change of changes) {
          if (change.kind === 'create') {
            await tx.tourDeparture.create({ data: { tourId, ...change.data } });
          } else if (change.kind === 'delete') {
            // Only a departure without sold seats may disappear.
            const removed = await tx.$executeRaw`DELETE FROM "TourDeparture" WHERE "id" = ${change.id}::uuid AND "tourId" = ${tourId}::uuid AND "remaining" = "capacity"`;
            if (removed !== 1) throw conflict;
          } else {
            const delta = change.capacity - change.expectedCapacity;
            const updated = await tx.tourDeparture.updateMany({
              where: {
                id: change.id,
                tourId,
                capacity: change.expectedCapacity,
                ...(change.lockSeats ? { remaining: change.expectedRemaining } : delta < 0 ? { remaining: { gte: -delta } } : {}),
              },
              data: {
                date: change.date,
                capacity: change.capacity,
                priceOverride: change.priceOverride,
                isOpen: change.isOpen,
                remaining: { increment: delta },
              },
            });
            if (updated.count !== 1) throw conflict;
          }
        }
      });
    } catch (error) {
      if (error === conflict) return null;
      throw error;
    }
    return this.findById(tourId);
  }

  setRatingStats(tourId: string, ratingAvg: number, ratingCount: number): Promise<unknown> {
    return prisma.tour.updateMany({ where: { id: tourId }, data: { ratingAvg, ratingCount } });
  }

  // --------------------------------------------------------- helpers

  private async paginate(where: Prisma.TourWhereInput, orderBy: Prisma.TourOrderByWithRelationInput[], page: PageRequest) {
    const [rows, total] = await Promise.all([
      prisma.tour.findMany({ where, orderBy, skip: toSkip(page), take: page.limit, include }),
      prisma.tour.count({ where }),
    ]);
    return { items: toRecords(rows), total };
  }
}

function createOne(db: DbExecutor, data: NewTour): Promise<Row> {
  const { categoryIds, departures, guide, itinerary, ...scalars } = data;
  return db.tour.create({
    data: {
      ...scalars,
      ...(itinerary ? { itinerary: itinerary as unknown as Prisma.InputJsonValue } : {}),
      ...(categoryIds?.length ? { categories: { connect: categoryIds.map((id) => ({ id })) } } : {}),
      ...(departures?.length ? { departures: { create: departures } } : {}),
      ...(guide ? { guideAssignment: { create: guide } } : {}),
    },
    include,
  });
}

export const toursRepository = new ToursRepository();
