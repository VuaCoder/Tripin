import { Types, type QueryFilter } from 'mongoose';
import { toSkip, type PageRequest } from '../../utils/pagination';
import { EarningModel, type EarningAttributes, type EarningDocument } from './earnings.model';
import type { EarningsRange } from './earnings.types';

export class EarningsRepository {
  create(data: Partial<EarningAttributes>): Promise<EarningDocument> {
    return EarningModel.create(data);
  }

  findByBookingId(bookingId: string): Promise<EarningDocument | null> {
    return EarningModel.findOne({ bookingId }).exec();
  }

  async listByGuide(guideId: string, range: EarningsRange, page: PageRequest) {
    const filter = this.filterOf(guideId, range);
    const [items, total] = await Promise.all([
      EarningModel.find(filter).sort({ earnedAt: -1, _id: -1 }).skip(toSkip(page)).limit(page.limit).exec(),
      EarningModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  /** Totals per calendar month (UTC) inside the range. */
  async summarize(guideId: string, range: EarningsRange): Promise<{ month: string; totalAmount: number; count: number }[]> {
    const rows = await EarningModel.aggregate<{ _id: string; totalAmount: number; count: number }>([
      { $match: { ...this.filterOf(guideId, range), guideId: new Types.ObjectId(guideId) } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$earnedAt', timezone: 'UTC' } }, totalAmount: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
    ]).exec();
    return rows.map((row) => ({ month: row._id, totalAmount: row.totalAmount, count: row.count }));
  }

  private filterOf(guideId: string, range: EarningsRange): QueryFilter<EarningAttributes> {
    const filter: QueryFilter<EarningAttributes> = { guideId };
    if (range.from || range.to) {
      filter.earnedAt = { ...(range.from ? { $gte: range.from } : {}), ...(range.to ? { $lte: range.to } : {}) };
    }
    return filter;
  }
}

export const earningsRepository = new EarningsRepository();
