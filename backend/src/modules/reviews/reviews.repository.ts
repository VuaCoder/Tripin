import { writeAudit } from '../audit/audit.writer';
import { writeNotification } from '../notifications/notifications.writer';
import type { AuditEntry } from '../audit/audit.types';
import { nullIfNotFound, prisma, type Prisma, type DbExecutor } from '../../config/database';
import { Prisma as Sql } from '../../generated/prisma/client';
import type { Review } from '../../generated/prisma/client';
import { toSkip, type PageRequest } from '../../utils/pagination';
import { REVIEW_STATUS, type ListModerationReviewsQuery, type ListPublicReviewsQuery, type ReviewSort, type ReviewStatus } from './reviews.types';

export type ReviewRecord = Review;

export type NewReview = Pick<Review, 'bookingId' | 'tourId' | 'tourTitle' | 'agencyId' | 'travelerId' | 'rating' | 'comment'> & { images?: string[] };

/** Plain-field changes (`null` clears a nullable column). */
export type ReviewPatch = Partial<Pick<Review, 'status' | 'hiddenReason' | 'moderatedById' | 'moderatedAt'>>;

const SORTS: Record<ReviewSort, Prisma.ReviewOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }, { id: 'desc' }],
  rating_desc: [{ rating: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
  rating_asc: [{ rating: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
};

export class ReviewsRepository {
  create(data: NewReview): Promise<ReviewRecord> {
    return prisma.$transaction(async (tx) => {
      await this.lockTour(tx, data.tourId);
      const review = await tx.review.create({ data });
      await this.refreshRating(tx, data.tourId);
      return review;
    });
  }

  findById(id: string): Promise<ReviewRecord | null> {
    return prisma.review.findUnique({ where: { id } });
  }

  findByBookingId(bookingId: string): Promise<ReviewRecord | null> {
    return prisma.review.findUnique({ where: { bookingId } });
  }

  /** Compare-and-set on the status so two moderators cannot overwrite each other. */
  async transition(id: string, expected: ReviewStatus, patch: ReviewPatch, audit?: AuditEntry, content?: Pick<Review, 'comment' | 'rating' | 'images'>): Promise<ReviewRecord | null> {
    return prisma.$transaction(async (tx) => {
      const current = await tx.review.findUnique({ where: { id }, select: { tourId: true } });
      if (!current) return null;
      await this.lockTour(tx, current.tourId);
      const updated = await tx.review.update({ where: { id, status: expected, ...(content ? { comment: content.comment, rating: content.rating, images: { equals: content.images } } : {}) }, data: patch });
      if (audit) await writeAudit(tx, audit);
      await this.refreshRating(tx, current.tourId);
      if (audit) {
        const hidden = updated.status === REVIEW_STATUS.HIDDEN;
        const reason = String(audit.metadata?.reason ?? '');
        for (const userId of new Set([updated.travelerId, updated.agencyId])) {
          await writeNotification(tx, userId, {
            type: 'REVIEW_MODERATED',
            title: hidden ? 'Đánh giá đã bị ẩn' : 'Đánh giá đã được khôi phục',
            body: `Đánh giá về "${updated.tourTitle}" đã ${hidden ? 'bị ẩn' : 'được khôi phục'}. Lý do kiểm duyệt: ${reason}`,
            data: { reviewId: id, tourId: updated.tourId },
          });
        }
      }
      return updated;
    }).catch(nullIfNotFound);
  }

  private async lockTour(tx: DbExecutor, tourId: string): Promise<void> {
    await tx.$queryRaw`SELECT "id" FROM "Tour" WHERE "id" = ${tourId}::uuid FOR UPDATE`;
  }

  private async refreshRating(tx: DbExecutor, tourId: string): Promise<void> {
    const stats = await tx.review.aggregate({ where: { tourId, status: REVIEW_STATUS.VISIBLE }, _avg: { rating: true }, _count: { _all: true } });
    await tx.tour.updateMany({ where: { id: tourId }, data: { ratingAvg: Math.round((stats._avg.rating ?? 0) * 100) / 100, ratingCount: stats._count._all } });
  }

  listPublic(query: ListPublicReviewsQuery) {
    if (query.guideId) return this.listPublicByGuide(query);
    const where: Prisma.ReviewWhereInput = { status: REVIEW_STATUS.VISIBLE };
    if (query.tourId) where.tourId = query.tourId;
    if (query.agencyId) where.agencyId = query.agencyId;
    return this.paginate(where, SORTS[query.sort], query);
  }

  /** Completed-trip earnings retain the guide who actually led the booking, even after reassignment. */
  private async listPublicByGuide(query: ListPublicReviewsQuery) {
    const filter = Sql.sql`r."status" = 'VISIBLE' AND EXISTS (
      SELECT 1 FROM "Earning" e WHERE e."bookingId" = r."bookingId" AND e."guideId" = ${query.guideId}::uuid
    )`;
    const order = query.sort === 'rating_desc' ? Sql.sql`r."rating" DESC,` : query.sort === 'rating_asc' ? Sql.sql`r."rating" ASC,` : Sql.empty;
    const [items, counts] = await Promise.all([
      prisma.$queryRaw<ReviewRecord[]>(Sql.sql`SELECT r.* FROM "Review" r WHERE ${filter}
        ORDER BY ${order} r."createdAt" DESC, r."id" DESC LIMIT ${query.limit} OFFSET ${toSkip(query)}`),
      prisma.$queryRaw<{ total: bigint }[]>(Sql.sql`SELECT COUNT(*) AS total FROM "Review" r WHERE ${filter}`),
    ]);
    return { items, total: Number(counts[0]?.total ?? 0) };
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

  async tourImagesFor(tourIds: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(tourIds.filter(Boolean))];
    if (unique.length === 0) return new Map();
    const rows = await prisma.tour.findMany({
      where: { id: { in: unique } },
      select: { id: true, images: true },
    });
    return new Map(rows.map((row) => [row.id, row.images?.[0] ?? '']));
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
