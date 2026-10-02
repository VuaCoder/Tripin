import { Types, type QueryFilter, type SortOrder, type UpdateQuery } from 'mongoose';
import { TOUR_STATUS, type TourStatus } from '@travel-platform/constants';
import { toSkip, type PageRequest } from '../../utils/pagination';
import { containsRegex } from '../../utils/regex';
import { TourModel, type TourAttributes, type TourDocument } from './tours.model';
import type { ListTourFilter, SearchToursQuery, TourSort } from './tours.types';

type Filter = QueryFilter<TourAttributes>;

const SORTS: Record<TourSort, Record<string, SortOrder>> = {
  newest: { createdAt: -1, _id: -1 },
  price_asc: { basePrice: 1, _id: 1 },
  price_desc: { basePrice: -1, _id: -1 },
  rating: { ratingAvg: -1, ratingCount: -1, _id: -1 },
};

/** All database access of the tours domain. */
export class ToursRepository {
  create(data: Partial<TourAttributes>): Promise<TourDocument> {
    return TourModel.create(data);
  }

  insertMany(data: Partial<TourAttributes>[]): Promise<TourDocument[]> {
    return TourModel.insertMany(data) as unknown as Promise<TourDocument[]>;
  }

  findById(id: string): Promise<TourDocument | null> {
    return TourModel.findById(id).exec();
  }

  findManyByIds(ids: string[]): Promise<TourDocument[]> {
    return TourModel.find({ _id: { $in: ids } }).exec();
  }

  /** Compare-and-set on status so a concurrent moderator decision / agency edit cannot be overwritten. */
  updateIfStatus(id: string, expected: readonly TourStatus[], update: UpdateQuery<TourAttributes>): Promise<TourDocument | null> {
    return TourModel.findOneAndUpdate({ _id: id, status: { $in: expected } }, update, { returnDocument: 'after', runValidators: true }).exec();
  }

  /** Updates a pending guide assignment atomically (guide answers only their own PENDING assignment). */
  answerGuideAssignment(tourId: string, guideId: string, update: UpdateQuery<TourAttributes>): Promise<TourDocument | null> {
    return TourModel.findOneAndUpdate(
      { _id: tourId, 'guide.guideId': guideId, 'guide.status': 'PENDING', status: { $ne: TOUR_STATUS.ARCHIVED } },
      update,
      { returnDocument: 'after' },
    ).exec();
  }

  // ------------------------------------------------------- discovery

  async searchPublic(query: SearchToursQuery): Promise<{ items: TourDocument[]; total: number }> {
    const filter: Filter = { status: TOUR_STATUS.APPROVED };
    if (query.q) {
      const regex = containsRegex(query.q);
      filter.$or = [{ title: regex }, { destination: regex }, { summary: regex }];
    }
    if (query.destination) filter.destination = containsRegex(query.destination);
    if (query.categoryId) filter.categoryIds = query.categoryId;
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      filter.basePrice = {
        ...(query.minPrice !== undefined ? { $gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { $lte: query.maxPrice } : {}),
      };
    }
    if (query.minDays !== undefined || query.maxDays !== undefined) {
      filter.durationDays = {
        ...(query.minDays !== undefined ? { $gte: query.minDays } : {}),
        ...(query.maxDays !== undefined ? { $lte: query.maxDays } : {}),
      };
    }
    if (query.minRating !== undefined) filter.ratingAvg = { $gte: query.minRating };
    if (query.departureFrom || query.departureTo) {
      // Only departures that can still be booked count for the date filter.
      const now = new Date();
      const from = query.departureFrom && query.departureFrom > now ? query.departureFrom : now;
      filter.departures = {
        $elemMatch: {
          isOpen: true,
          remaining: { $gt: 0 },
          date: { $gte: from, ...(query.departureTo ? { $lte: query.departureTo } : {}) },
        },
      };
    }
    return this.paginate(filter, SORTS[query.sort], query);
  }

  listByAgency(agencyId: string, status: TourStatus | undefined, page: PageRequest) {
    const filter: Filter = { agencyId, status: status ?? { $ne: TOUR_STATUS.ARCHIVED } };
    return this.paginate(filter, { updatedAt: -1, _id: -1 }, page);
  }

  listByGuide(guideId: string, page: PageRequest) {
    const filter: Filter = { 'guide.guideId': guideId, status: { $ne: TOUR_STATUS.ARCHIVED } };
    return this.paginate(filter, { updatedAt: -1, _id: -1 }, page);
  }

  /** Moderator list: every status (ARCHIVED excluded unless asked for). */
  listForModeration(filter: ListTourFilter, page: PageRequest) {
    const query: Filter = { status: filter.status ?? { $ne: TOUR_STATUS.ARCHIVED } };
    if (filter.agencyId) query.agencyId = filter.agencyId;
    if (filter.q) {
      const regex = containsRegex(filter.q);
      query.$or = [{ title: regex }, { destination: regex }];
    }
    return this.paginate(query, { submittedAt: -1, _id: -1 }, page);
  }

  /** Tours per status, for one agency or (no argument) the whole platform. */
  countByStatus(agencyId?: string): Promise<{ _id: TourStatus; count: number }[]> {
    return TourModel.aggregate<{ _id: TourStatus; count: number }>([
      ...(agencyId ? [{ $match: { agencyId: new Types.ObjectId(agencyId) } }] : []),
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).exec();
  }

  // ------------------------------------------------------ inventory

  /**
   * Atomically takes `seats` from an open, future departure of an APPROVED tour.
   * Returns false when the departure is missing/closed/past/sold out — never oversells.
   */
  async reserveSeats(tourId: string, departureId: string, seats: number): Promise<boolean> {
    const result = await TourModel.updateOne(
      {
        _id: tourId,
        status: TOUR_STATUS.APPROVED,
        departures: { $elemMatch: { _id: departureId, isOpen: true, date: { $gt: new Date() }, remaining: { $gte: seats } } },
      },
      { $inc: { 'departures.$.remaining': -seats, __v: 1 } },
    ).exec();
    return result.modifiedCount === 1;
  }

  /** Gives seats back (booking cancelled / payment expired). Never exceeds capacity. */
  async releaseSeats(tourId: string, departureId: string, seats: number): Promise<void> {
    await TourModel.updateOne(
      { _id: tourId, 'departures._id': departureId },
      [
        {
          $set: {
            __v: { $add: ['$__v', 1] },
            departures: {
              $map: {
                input: '$departures',
                as: 'd',
                in: {
                  $cond: [
                    { $eq: ['$$d._id', { $toObjectId: departureId }] },
                    { $mergeObjects: ['$$d', { remaining: { $min: ['$$d.capacity', { $add: ['$$d.remaining', seats] }] } }] },
                    '$$d',
                  ],
                },
              },
            },
          },
        },
      ],
      // Mongoose 9 refuses array (aggregation pipeline) updates unless this is set explicitly.
      { updatePipeline: true },
    ).exec();
  }

  /**
   * Replaces the departures only if nobody changed the document meanwhile (`__v` is bumped by every seat change),
   * so an availability edit can never overwrite seats just sold. Returns null on conflict.
   */
  replaceDeparturesIfVersion(id: string, version: number, departures: unknown[]): Promise<TourDocument | null> {
    return TourModel.findOneAndUpdate(
      { _id: id, __v: version } as never,
      { $set: { departures }, $inc: { __v: 1 } },
      { returnDocument: 'after', runValidators: true },
    ).exec();
  }

  setRatingStats(tourId: string, ratingAvg: number, ratingCount: number): Promise<unknown> {
    return TourModel.updateOne({ _id: tourId }, { $set: { ratingAvg, ratingCount } }).exec();
  }

  // --------------------------------------------------------- helpers

  private async paginate(filter: Filter, sort: Record<string, SortOrder>, page: PageRequest) {
    const [items, total] = await Promise.all([
      TourModel.find(filter).sort(sort).skip(toSkip(page)).limit(page.limit).exec(),
      TourModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }
}

export const toursRepository = new ToursRepository();
