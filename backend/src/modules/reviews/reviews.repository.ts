import { Types, type QueryFilter, type SortOrder, type UpdateQuery } from 'mongoose';
import { toSkip, type PageRequest } from '../../utils/pagination';
import { ReviewModel, type ReviewAttributes, type ReviewDocument } from './reviews.model';
import { REVIEW_STATUS, type ListModerationReviewsQuery, type ListPublicReviewsQuery, type ReviewSort, type ReviewStatus } from './reviews.types';

const SORTS: Record<ReviewSort, Record<string, SortOrder>> = {
  newest: { createdAt: -1, _id: -1 },
  rating_desc: { rating: -1, createdAt: -1, _id: -1 },
  rating_asc: { rating: 1, createdAt: -1, _id: -1 },
};

export class ReviewsRepository {
  create(data: Partial<ReviewAttributes>): Promise<ReviewDocument> {
    return ReviewModel.create(data);
  }

  findById(id: string): Promise<ReviewDocument | null> {
    return ReviewModel.findById(id).exec();
  }

  findByBookingId(bookingId: string): Promise<ReviewDocument | null> {
    return ReviewModel.findOne({ bookingId }).exec();
  }

  /** Compare-and-set on the status so two moderators cannot overwrite each other. */
  transition(id: string, expected: ReviewStatus, update: UpdateQuery<ReviewAttributes>): Promise<ReviewDocument | null> {
    return ReviewModel.findOneAndUpdate({ _id: id, status: expected }, update, { returnDocument: 'after' }).exec();
  }

  listPublic(query: ListPublicReviewsQuery) {
    const filter: QueryFilter<ReviewAttributes> = { status: REVIEW_STATUS.VISIBLE };
    if (query.tourId) filter.tourId = query.tourId;
    if (query.agencyId) filter.agencyId = query.agencyId;
    return this.paginate(filter, SORTS[query.sort], query);
  }

  listByTraveler(travelerId: string, page: PageRequest) {
    return this.paginate({ travelerId }, { createdAt: -1, _id: -1 }, page);
  }

  listForModeration(query: ListModerationReviewsQuery) {
    const filter: QueryFilter<ReviewAttributes> = {};
    if (query.status) filter.status = query.status;
    if (query.tourId) filter.tourId = query.tourId;
    return this.paginate(filter, { createdAt: -1, _id: -1 }, query);
  }

  countByStatus(): Promise<{ _id: ReviewStatus; count: number }[]> {
    return ReviewModel.aggregate<{ _id: ReviewStatus; count: number }>([{ $group: { _id: '$status', count: { $sum: 1 } } }]).exec();
  }

  /** Average rating and count over the VISIBLE reviews of one tour. */
  async visibleStats(tourId: string): Promise<{ avg: number; count: number }> {
    const [row] = await ReviewModel.aggregate<{ avg: number; count: number }>([
      { $match: { tourId: new Types.ObjectId(tourId), status: REVIEW_STATUS.VISIBLE } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]).exec();
    return { avg: row?.avg ?? 0, count: row?.count ?? 0 };
  }

  private async paginate(filter: QueryFilter<ReviewAttributes>, sort: Record<string, SortOrder>, page: PageRequest) {
    const [items, total] = await Promise.all([
      ReviewModel.find(filter).sort(sort).skip(toSkip(page)).limit(page.limit).exec(),
      ReviewModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }
}

export const reviewsRepository = new ReviewsRepository();
