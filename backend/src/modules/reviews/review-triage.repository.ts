import { prisma } from '../../config/database';
import { AppError } from '../../utils/app-error';
import { toSkip, type PageRequest } from '../../utils/pagination';
import { writeAudit } from '../audit/audit.writer';
import { AUDIT_ACTIONS } from '../audit/audit.types';
import { writeNotification } from '../notifications/notifications.writer';
import { reviewContentVersion } from './reviews.revision';
import type { Review } from '../../generated/prisma/client';
import type { PersistedRole } from '@travel-platform/constants';

const openReports = { targetType: 'REVIEW' as const, status: { in: ['OPEN' as const, 'AGENCY_RESPONDED' as const] } };
export class ReviewTriageRepository {
  async list(page: PageRequest) {
    const [rows, counts] = await Promise.all([
      prisma.$queryRaw<Review[]>`SELECT r.* FROM "Review" r WHERE EXISTS (SELECT 1 FROM "Report" p WHERE p."targetType" = 'REVIEW' AND p."targetId" = r.id AND p.status IN ('OPEN', 'AGENCY_RESPONDED')) ORDER BY r."createdAt", r.id LIMIT ${page.limit} OFFSET ${toSkip(page)}`,
      prisma.$queryRaw<{ total: bigint }[]>`SELECT COUNT(*) AS total FROM "Review" r WHERE EXISTS (SELECT 1 FROM "Report" p WHERE p."targetType" = 'REVIEW' AND p."targetId" = r.id AND p.status IN ('OPEN', 'AGENCY_RESPONDED'))`,
    ]);
    const items = await Promise.all(rows.map(async (review) => {
      const [reports, reportCount] = await Promise.all([
        prisma.report.findMany({ where: { ...openReports, targetId: review.id }, select: { id: true, category: true, description: true, createdAt: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 100 }),
        prisma.report.count({ where: { ...openReports, targetId: review.id } }),
      ]);
      return { id: review.id, tourTitle: review.tourTitle, comment: review.comment, rating: review.rating, status: review.status, contentVersion: reviewContentVersion(review), reports, reportCount };
    }));
    return { items, total: Number(counts[0]?.total ?? 0) };
  }
  async decide(actor: { userId: string; role: PersistedRole }, id: string, input: { keep: boolean; reason: string; contentVersion: string; reportIds: string[] }) {
    return prisma.$transaction(async (tx) => {
      const review = await tx.review.findUnique({ where: { id } });
      if (!review) throw AppError.notFound('Review not found');
      await tx.$queryRaw`SELECT "id" FROM "Tour" WHERE "id" = ${review.tourId}::uuid FOR UPDATE`;
      if (reviewContentVersion(review) !== input.contentVersion) throw AppError.conflict('Review changed. Reload before deciding.', 'REVIEW_REVISION_CONFLICT');
      const status = input.keep ? 'VISIBLE' : 'HIDDEN';
      const mutation = await tx.review.updateMany({ where: { id, status: review.status, comment: review.comment, rating: review.rating, images: { equals: review.images } }, data: { status, hiddenReason: input.keep ? null : input.reason, moderatedById: actor.userId, moderatedAt: new Date() } });
      if (mutation.count !== 1) throw AppError.conflict('Review changed. Reload before deciding.', 'REVIEW_REVISION_CONFLICT');
      const reportStatus = input.keep ? 'REJECTED' : 'RESOLVED';
      const reports = await tx.report.updateMany({ where: { ...openReports, targetId: id, id: { in: input.reportIds } }, data: { status: reportStatus, resolutionDecision: reportStatus, resolutionNote: input.reason, resolutionById: actor.userId, resolvedAt: new Date(), openKey: null } });
      if (reports.count !== input.reportIds.length) throw AppError.conflict('Reports changed. Reload the queue.', 'REPORT_SNAPSHOT_CONFLICT');
      const stats = await tx.review.aggregate({ where: { tourId: review.tourId, status: 'VISIBLE' }, _avg: { rating: true }, _count: { _all: true } });
      await tx.tour.updateMany({ where: { id: review.tourId }, data: { ratingAvg: Math.round((stats._avg.rating ?? 0) * 100) / 100, ratingCount: stats._count._all } });
      await writeAudit(tx, { actorId: actor.userId, actorRole: actor.role, action: AUDIT_ACTIONS.REVIEW_MODERATED, targetType: 'review', targetId: id, metadata: { keep: input.keep, reason: input.reason, reportIds: input.reportIds, before: { status: review.status }, after: { status } } });
      for (const userId of new Set([review.travelerId, review.agencyId])) await writeNotification(tx, userId, { type: 'REVIEW_MODERATED', title: input.keep ? 'Đánh giá được giữ lại' : 'Đánh giá đã bị ẩn', body: `Đánh giá về "${review.tourTitle}": ${input.reason}`, data: { reviewId: id, tourId: review.tourId } });
      return { id, status, resolvedReports: reports.count };
    });
  }
}
export const reviewTriageRepository = new ReviewTriageRepository();
