import { Types, type QueryFilter, type SortOrder, type UpdateQuery } from 'mongoose';
import { BOOKING_STATUS, type BookingStatus } from '@travel-platform/constants';
import { toSkip, type PageRequest } from '../../utils/pagination';
import { BookingModel, type BookingAttributes, type BookingDocument } from './bookings.model';
import type { ListAgencyBookingsQuery, RevenueTotals } from './bookings.types';

type Filter = QueryFilter<BookingAttributes>;

export class BookingsRepository {
  create(data: Partial<BookingAttributes>): Promise<BookingDocument> {
    return BookingModel.create(data);
  }

  findById(id: string): Promise<BookingDocument | null> {
    return BookingModel.findById(id).exec();
  }

  findByRequestId(travelerId: string, clientRequestId: string): Promise<BookingDocument | null> {
    // `$type` repeats the partial-index condition: without it MongoDB cannot use the (travelerId, clientRequestId) index.
    return BookingModel.findOne({ travelerId, clientRequestId: { $eq: clientRequestId, $type: 'string' } }).exec();
  }

  /** Compare-and-set on status: returns null when the booking is no longer in one of the expected statuses. */
  transition(id: string, expected: readonly BookingStatus[], update: UpdateQuery<BookingAttributes>): Promise<BookingDocument | null> {
    return BookingModel.findOneAndUpdate({ _id: id, status: { $in: expected } }, update, { returnDocument: 'after' }).exec();
  }

  updateById(id: string, update: UpdateQuery<BookingAttributes>): Promise<BookingDocument | null> {
    return BookingModel.findByIdAndUpdate(id, update, { returnDocument: 'after' }).exec();
  }

  listByTraveler(travelerId: string, status: BookingStatus | undefined, page: PageRequest) {
    const filter: Filter = { travelerId };
    if (status) filter.status = status;
    return this.paginate(filter, { createdAt: -1, _id: -1 }, page);
  }

  listByAgency(agencyId: string, query: ListAgencyBookingsQuery) {
    const filter: Filter = { agencyId };
    if (query.status) filter.status = query.status;
    if (query.tourId) filter.tourId = query.tourId;
    if (query.departureFrom || query.departureTo) {
      filter.departureDate = {
        ...(query.departureFrom ? { $gte: query.departureFrom } : {}),
        ...(query.departureTo ? { $lte: query.departureTo } : {}),
      };
    }
    return this.paginate(filter, { createdAt: -1, _id: -1 }, query);
  }

  /** PENDING bookings whose payment window has passed. */
  findExpiredPending(now: Date, limit: number): Promise<BookingDocument[]> {
    return BookingModel.find({ status: BOOKING_STATUS.PENDING, paymentExpiresAt: { $lt: now } }).limit(limit).exec();
  }

  /** CONFIRMED bookings whose tour has ended. */
  findDueForCompletion(now: Date, limit: number): Promise<BookingDocument[]> {
    return BookingModel.find({ status: BOOKING_STATUS.CONFIRMED, endDate: { $lt: now } }).limit(limit).exec();
  }


  /** Paid bookings of one tour of one agency, optionally one departure, in departure order (capped). */
  listPaidForTour(agencyId: string, tourId: string, departureId: string | undefined, limit: number): Promise<BookingDocument[]> {
    const filter: Filter = { agencyId, tourId, status: { $in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.COMPLETED] } };
    if (departureId) filter.departureId = departureId;
    return BookingModel.find(filter).sort({ departureDate: 1, createdAt: 1, _id: 1 }).limit(limit).exec();
  }

  // ---- dashboard read models (paid = CONFIRMED + COMPLETED)

  private matchOf(agencyId?: string, extra: Record<string, unknown> = {}) {
    return { ...(agencyId ? { agencyId: new Types.ObjectId(agencyId) } : {}), ...extra };
  }

  private static readonly PAID = { status: { $in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.COMPLETED] } };

  async statusCounts(agencyId?: string): Promise<Record<string, number>> {
    const rows = await BookingModel.aggregate<{ _id: string; count: number }>([
      { $match: this.matchOf(agencyId) },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).exec();
    return Object.fromEntries(rows.map((row) => [row._id, row.count]));
  }

  async revenueTotals(agencyId?: string): Promise<RevenueTotals> {
    const [row] = await BookingModel.aggregate<{ bookings: number; gross: number; commission: number; net: number }>([
      { $match: this.matchOf(agencyId, BookingsRepository.PAID) },
      { $group: { _id: null, bookings: { $sum: 1 }, gross: { $sum: '$totalAmount' }, commission: { $sum: '$commissionAmount' }, net: { $sum: '$agencyAmount' } } },
    ]).exec();
    return { bookings: row?.bookings ?? 0, gross: row?.gross ?? 0, commission: row?.commission ?? 0, net: row?.net ?? 0 };
  }

  async dailyNet(agencyId: string, since: Date): Promise<{ date: string; bookings: number; net: number }[]> {
    const rows = await BookingModel.aggregate<{ _id: string; bookings: number; net: number }>([
      { $match: this.matchOf(agencyId, { ...BookingsRepository.PAID, confirmedAt: { $gte: since } }) },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$confirmedAt', timezone: 'UTC' } }, bookings: { $sum: 1 }, net: { $sum: '$agencyAmount' } } },
      { $sort: { _id: 1 } },
    ]).exec();
    return rows.map((row) => ({ date: row._id, bookings: row.bookings, net: row.net }));
  }

  async monthlyTotals(since: Date): Promise<{ month: string; bookings: number; gross: number; commission: number }[]> {
    const rows = await BookingModel.aggregate<{ _id: string; bookings: number; gross: number; commission: number }>([
      { $match: { ...BookingsRepository.PAID, confirmedAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$confirmedAt', timezone: 'UTC' } }, bookings: { $sum: 1 }, gross: { $sum: '$totalAmount' }, commission: { $sum: '$commissionAmount' } } },
      { $sort: { _id: 1 } },
    ]).exec();
    return rows.map((row) => ({ month: row._id, bookings: row.bookings, gross: row.gross, commission: row.commission }));
  }

  async topTours(agencyId: string, limit: number): Promise<{ tourId: string; title: string; bookings: number; net: number }[]> {
    const rows = await BookingModel.aggregate<{ _id: Types.ObjectId; title: string; bookings: number; net: number }>([
      { $match: this.matchOf(agencyId, BookingsRepository.PAID) },
      { $group: { _id: '$tourId', title: { $last: '$tourTitle' }, bookings: { $sum: 1 }, net: { $sum: '$agencyAmount' } } },
      { $sort: { net: -1, bookings: -1 } },
      { $limit: limit },
    ]).exec();
    return rows.map((row) => ({ tourId: String(row._id), title: row.title, bookings: row.bookings, net: row.net }));
  }

  private async paginate(filter: Filter, sort: Record<string, SortOrder>, page: PageRequest) {
    const [items, total] = await Promise.all([
      BookingModel.find(filter).sort(sort).skip(toSkip(page)).limit(page.limit).exec(),
      BookingModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }
}

export const bookingsRepository = new BookingsRepository();
