import { prisma, runInTransaction } from '../../config/database';
import { logger } from '../../utils/logger';
import { writeAgencyNotification, writeNotification } from '../notifications/notifications.writer';
import { DAY, ensureCompletion } from './completion.service';

/** Daily reminder after +24h; overdue after +72h. Historical COMPLETED rows are excluded. */
export async function remindDueCompletions(now = new Date()) {
  // Scan unreminded/oldest-first groups rather than letting already-reminded departures starve later ones.
  const groups = await prisma.$queryRaw<{ agencyId: string; tourId: string; departureId: string }[]>`
    SELECT b."agencyId", b."tourId", b."departureId" FROM "Booking" b
    LEFT JOIN "TourCompletion" c ON c."departureId" = b."departureId"
    WHERE b.status = 'CONFIRMED' AND b."endDate" <= ${new Date(now.getTime() - DAY)}
      AND c."completedAt" IS NULL AND (c."remindedAt" IS NULL OR c."remindedAt" <= ${new Date(now.getTime() - DAY)})
    GROUP BY b."agencyId", b."tourId", b."departureId", c."remindedAt"
    ORDER BY c."remindedAt" ASC NULLS FIRST, b."departureId" LIMIT 200`;
  let count = 0;
  for (const group of groups) {
    try {
      count += await runInTransaction(async tx => {
        const { completion } = await ensureCompletion(tx, group.agencyId, group.tourId, group.departureId);
        if (completion.completedAt || completion.scheduledEndAt.getTime() + DAY > now.getTime()) return 0;
        if (completion.remindedAt && now.getTime() - completion.remindedAt.getTime() < DAY) return 0;
        const overdue = now.getTime() - completion.scheduledEndAt.getTime() >= 3 * DAY;
        const snapshot = completion.snapshot as { title: string };
        await writeAgencyNotification(tx, group.agencyId, { type: overdue ? 'TOUR_COMPLETION_OVERDUE' : 'TOUR_COMPLETION_DUE',
          title: overdue ? 'Chuyến đi quá hạn hoàn tất báo cáo' : 'Chuyến đi đang chờ hoàn tất',
          body: `Chuyến đi ${snapshot.title} đã kết thúc. Vui lòng gửi báo cáo và xác nhận hoàn tất.`,
          data: { tourId: group.tourId, departureId: group.departureId, href: `/agency/completions?tourId=${group.tourId}&departureId=${group.departureId}` } });
        await tx.tourCompletion.update({ where: { id: completion.id }, data: { remindedAt: now, ...(overdue && !completion.escalatedAt ? { escalatedAt: now } : {}) } });
        return 1;
      });
    } catch (error) { logger.error('Could not remind tour completion', { departureId: group.departureId, message: (error as Error).message }); }
  }
  return count;
}

/** A failed transaction rolls back notifications, emails, ticket and earning together; the item stays retryable. */
export async function deliverPendingCompletions(now = new Date()) {
  const due = await prisma.tourCompletionDelivery.findMany({ where: { deliveredAt: null, nextAttemptAt: { lte: now } }, take: 100, orderBy: [{ nextAttemptAt: 'asc' }, { id: 'asc' }] });
  let count = 0;
  for (const item of due) {
    try {
      count += await runInTransaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "TourCompletionDelivery" WHERE id = ${item.id}::uuid FOR UPDATE`;
        const delivery = await tx.tourCompletionDelivery.findUniqueOrThrow({ where: { id: item.id } });
        if (delivery.deliveredAt) return 0;
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: delivery.bookingId } });
        if (booking.status !== 'COMPLETED') throw new Error('Completion booking is no longer COMPLETED');
        await tx.eTicket.updateMany({ where: { bookingId: booking.id, status: 'VALID' }, data: { status: 'USED', usedAt: booking.completedAt ?? now } });
        if (delivery.guideId && delivery.guideFee !== null) {
          const existing = await tx.earning.findUnique({ where: { bookingId: booking.id } });
          if (!existing) {
            await tx.earning.create({ data: { bookingId: booking.id, bookingCode: booking.bookingCode, tourId: booking.tourId,
              tourTitle: booking.tourTitle, agencyId: booking.agencyId, guideId: delivery.guideId, amount: delivery.guideFee, earnedAt: booking.completedAt ?? now } });
            await writeNotification(tx, delivery.guideId, { type: 'EARNING_RECORDED', title: 'Đã ghi nhận phí hướng dẫn',
              body: `Đã ghi nhận phí hướng dẫn cho chuyến đi ${booking.tourTitle}.`, data: { bookingId: booking.id } });
          }
        }
        const attended = booking.attendedParticipants !== 0;
        await writeNotification(tx, booking.travelerId, { type: 'BOOKING_COMPLETED', title: 'Chuyến đi đã hoàn thành',
          body: attended ? `Agency đã hoàn tất chuyến đi ${booking.tourTitle}. Bạn có muốn chia sẻ trải nghiệm bằng một đánh giá không?`
            : `Agency đã hoàn tất chuyến đi ${booking.tourTitle} và ghi nhận nhóm của bạn không tham gia. Liên hệ Agency nếu thông tin chưa đúng.`,
          data: { bookingId: booking.id, tourId: booking.tourId, reviewEligible: String(attended), href: `/settings/history/${booking.id}` } });
        await tx.tourCompletionDelivery.update({ where: { id: delivery.id }, data: { deliveredAt: now, attempts: { increment: 1 } } });
        return 1;
      });
    } catch (error) {
      await prisma.tourCompletionDelivery.updateMany({ where: { id: item.id, deliveredAt: null }, data: { attempts: { increment: 1 }, nextAttemptAt: new Date(now.getTime() + Math.min(60, 2 ** Math.min(item.attempts, 6)) * 60_000) } });
      logger.error('Could not deliver tour completion', { bookingId: item.bookingId, message: (error as Error).message });
    }
  }
  return count;
}
