import { nullIfNotFound, prisma, type Prisma } from '../../config/database';
import type { Review } from '../../generated/prisma/client';
import { toSkip, type PageRequest } from '../../utils/pagination';
import { REVIEW_STATUS, type ListModerationReviewsQuery, type ListPublicReviewsQuery, type ReviewSort, type ReviewStatus } from './reviews.types';

export type ReviewRecord = Review;

export type NewReview = Pick<Review, 'bookingId' | 'tourId' | 'tourTitle' | 'agencyId' | 'travelerId' | 'rating' | 'comment'>;

/** Plain-field changes (`null` clears a nullable column). */
export type ReviewPatch = Partial<Pick<Review, 'status' | 'hiddenReason' | 'moderatedById' | 'moderatedAt'>>;

const SORTS: Record<ReviewSort, Prisma.ReviewOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }, { id: 'desc' }],
  rating_desc: [{ rating: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
  rating_asc: [{ rating: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
};

export class ReviewsRepository {
  create(data: NewReview): Promise<ReviewRecord> {
    return prisma.review.create({ data });
  }

  findById(id: string): Promise<ReviewRecord | null> {
    return prisma.review.findUnique({ where: { id } });
  }

  findByBookingId(bookingId: string): Promise<ReviewRecord | null> {
    return prisma.review.findUnique({ where: { bookingId } });
  }

  /** Compare-and-set on the status so two moderators cannot overwrite each other. */
  transition(id: string, expected: ReviewStatus, patch: ReviewPatch): Promise<ReviewRecord | null> {
    return prisma.review.update({ where: { id, status: expected }, data: patch }).catch(nullIfNotFound);
  }

  listPublic(query: ListPublicReviewsQuery) {
    const where: Prisma.ReviewWhereInput = { status: REVIEW_STATUS.VISIBLE };
    if (query.tourId) where.tourId = query.tourId;
    if (query.agencyId) where.agencyId = query.agencyId;
    return this.paginate(where, SORTS[query.sort], query);
  }

  listByTraveler(travelerId: string, page: PageRequest) {
    return this.paginate({ travelerId }, SORTS.newest, page);
  }

  listForModeration(query: ListModerationReviewsQuery) {
    const where: Prisma.ReviewWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.tourId) where.tourId = query.tourId;
    return this.paginate(where, SORTS.newest, query);
  }

  async countByStatus(): Promise<{ status: ReviewStatus; count: number }[]> {
    const rows = await prisma.review.groupBy({ by: ['status'], _count: { _all: true } });
    return rows.map((row) => ({ status: row.status, count: row._count._all }));
  }

  /** Average rating and count over the VISIBLE reviews of one tour. */
  async visibleStats(tourId: string): Promise<{ avg: number; count: number }> {
    const stats = await prisma.review.aggregate({ where: { tourId, status: REVIEW_STATUS.VISIBLE }, _avg: { rating: true }, _count: { _all: true } });
    return { avg: stats._avg.rating ?? 0, count: stats._count._all };
  }

  private async paginate(where: Prisma.ReviewWhereInput, orderBy: Prisma.ReviewOrderByWithRelationInput[], page: PageRequest) {
    const [items, total] = await Promise.all([
      prisma.review.findMany({ where, orderBy, skip: toSkip(page), take: page.limit }),
      prisma.review.count({ where }),
    ]);
    return { items, total };
  }
}

export const reviewsRepository = new ReviewsRepository();
