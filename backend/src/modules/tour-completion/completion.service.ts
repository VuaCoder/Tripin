import { runInTransaction, type DbExecutor, type Prisma } from '../../config/database';
import { PERMISSIONS, type PersistedRole } from '@travel-platform/constants';
import { AppError } from '../../utils/app-error';
import { writeAudit } from '../audit/audit.writer';
import type { CompletionReportInput } from './completion.validation';
import { agencyAccessInclude, effectiveAgencyPermissions } from '../agencies/agency.policy';
import { bookedGuestCounts } from './completion.guests';
import { bookedCompletionServices } from './completion.services';

export const DAY = 86_400_000;
type Actor = { agencyId: string; userId: string; role: PersistedRole };
export const json = (value: unknown) => JSON.parse(JSON.stringify(value, (_key, v) => typeof v === 'bigint' ? v.toString() : v)) as Prisma.InputJsonObject;

/** Shared lock order: tenant, tour, departure. Report/history mutations serialize per tenant. */
export async function ensureCompletion(tx: DbExecutor, agencyId: string, tourId: string, departureId: string) {
  await tx.$queryRaw`SELECT id FROM "AgencyProfile" WHERE id = ${agencyId}::uuid FOR UPDATE`;
  const owned = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Tour" WHERE id = ${tourId}::uuid AND "agencyId" = ${agencyId}::uuid FOR UPDATE`;
  if (!owned.length) throw AppError.notFound('Không tìm thấy tour của Agency.');
  await tx.$queryRaw`SELECT id FROM "TourDeparture" WHERE id = ${departureId}::uuid AND "tourId" = ${tourId}::uuid FOR UPDATE`;
  const departure = await tx.tourDeparture.findFirst({ where: { id: departureId, tourId, tour: { agencyId } }, include: { tour: { include: { guideAssignment: true } } } });
  if (!departure) throw AppError.notFound('Không tìm thấy đợt khởi hành của Agency.');
  if (departure.date > new Date()) throw AppError.conflict('Đợt khởi hành chưa bắt đầu. Báo cáo sẽ mở sau khi khởi hành.', 'TRIP_NOT_STARTED');
  let completion = await tx.tourCompletion.findUnique({ where: { departureId } });
  if (!completion) {
    const end = await tx.booking.aggregate({ where: { departureId, tourId, agencyId, status: { in: ['CONFIRMED', 'COMPLETED'] } }, _max: { endDate: true } });
    completion = await tx.tourCompletion.create({ data: {
      agencyId, tourId, departureId,
      scheduledEndAt: end._max.endDate ?? new Date(departure.date.getTime() + departure.tour.durationDays * DAY),
      snapshot: json({ title: departure.tour.title, departureAt: departure.date, durationDays: departure.tour.durationDays,
        itinerary: departure.tour.itinerary, guide: departure.tour.guideAssignment }),
    } });
  }
  return { completion, departure };
}

async function detail(tx: DbExecutor, agencyId: string, tourId: string, departureId: string) {
  const { completion } = await ensureCompletion(tx, agencyId, tourId, departureId);
  const bookings = await tx.booking.findMany({ where: { agencyId, tourId, departureId, status: { in: ['CONFIRMED', 'COMPLETED'] } },
    select: { id: true, bookingCode: true, participants: true, attendedParticipants: true, status: true, guestPricing: true, passengerSnapshot: true, serviceSnapshot: true }, orderBy: { bookingCode: 'asc' } });
  const reports = await tx.tourCompletionReport.findMany({ where: { completionId: completion.id }, orderBy: { revision: 'desc' } });
  return { ...completion, bookedGuests: bookedGuestCounts(bookings), bookedServices: bookedCompletionServices(bookings),
    bookings: bookings.map(({ guestPricing: _pricing, passengerSnapshot: _people, serviceSnapshot: _services, ...booking }) => booking), reports };
}

export const completionService = {
  get(agencyId: string, tourId: string, departureId: string) {
    return runInTransaction(tx => detail(tx, agencyId, tourId, departureId));
  },

  save(actor: Actor, tourId: string, departureId: string, input: CompletionReportInput, submit: boolean) {
    return runInTransaction(async tx => {
      const { completion, departure } = await ensureCompletion(tx, actor.agencyId, tourId, departureId);
      const member = await tx.agencyMember.findUnique({ where: { agencyId_userId: { agencyId: actor.agencyId, userId: actor.userId } }, include: { ...agencyAccessInclude, user: true } });
      if (!member || member.status !== 'ACTIVE' || member.user.status !== 'ACTIVE' || member.user.staffStatus !== 'ACTIVE' ||
        !['OWNER', 'MANAGER'].includes(member.role) || !effectiveAgencyPermissions(member).includes(PERMISSIONS.TOUR_UPDATE_OWN)) {
        throw AppError.forbidden('Quyền hoàn tất chuyến đi đã thay đổi.');
      }
      if (completion.revision !== input.expectedRevision) throw AppError.conflict('Báo cáo đã thay đổi. Hãy tải lại trước khi lưu.', 'CONCURRENT_UPDATE');
      if (completion.completedAt && !submit) throw AppError.conflict('Báo cáo đã chốt. Hãy gửi bản bổ sung kèm lý do.');
      const now = new Date();
      // Lock all selected bookings before checking attendance or committing completion.
      await tx.$queryRaw`SELECT id FROM "Booking" WHERE "agencyId" = ${actor.agencyId}::uuid AND "tourId" = ${tourId}::uuid AND "departureId" = ${departureId}::uuid ORDER BY id FOR UPDATE`;
      const bookings = await tx.booking.findMany({ where: { agencyId: actor.agencyId, tourId, departureId, status: { in: ['CONFIRMED', 'COMPLETED'] } } });
      const bookedServices = bookedCompletionServices(bookings);
      const confirmations = input.serviceConfirmations ?? [];
      if (new Set(confirmations.map(s => s.key)).size !== confirmations.length || confirmations.some(s => !bookedServices.some(b => b.key === s.key))) throw AppError.badRequest('Dịch vụ xác nhận không thuộc các booking của chuyến đi.');
      if (submit && (confirmations.length !== bookedServices.length || confirmations.some(s => s.status === 'UNCONFIRMED'))) throw AppError.badRequest('Hãy xác nhận tất cả dịch vụ mua thêm trong booking.');
      if (submit) {
        if (completion.scheduledEndAt > now || bookings.some(b => b.endDate > now)) throw AppError.conflict('Chuyến đi chưa đến thời gian kết thúc.', 'TRIP_NOT_ENDED');
        const actual = input.actualEndAt ? new Date(input.actualEndAt) : null;
        if (actual && (actual < departure.date || actual > now)) throw AppError.badRequest('Giờ kết thúc thực tế phải nằm giữa giờ khởi hành và hiện tại.');
        if (input.summary.length < 20) throw AppError.badRequest('Hãy nhập tổng kết chuyến đi ít nhất 20 ký tự.');
        if (input.services && Object.values(input.services).some(value => value === 'UNCONFIRMED')) throw AppError.badRequest('Hãy xác nhận tình trạng các dịch vụ.');
        if (input.noChanges === false && input.changes.length < 10) throw AppError.badRequest('Hãy mô tả thay đổi ít nhất 10 ký tự.');
        if (input.noIncidents === false && input.incidents.length < 10) throw AppError.badRequest('Hãy mô tả sự cố và cách xử lý ít nhất 10 ký tự.');
        if (input.noChanges === true && input.changes) throw AppError.badRequest('Nội dung thay đổi không khớp lựa chọn Không có thay đổi.');
        if (input.noIncidents === true && input.incidents) throw AppError.badRequest('Nội dung sự cố không khớp lựa chọn Không có sự cố.');
        if (completion.completedAt && input.amendmentReason.length < 10) throw AppError.badRequest('Hãy giải thích lý do bổ sung ít nhất 10 ký tự.');
        if (!completion.completedAt && !bookings.some(b => b.status === 'CONFIRMED')) throw AppError.conflict('Không còn booking cần hoàn tất. Các booking lịch sử được giữ nguyên.');
      }
      const aggregate = input.actualParticipants !== undefined;
      const bookedTotal = bookings.reduce((sum, b) => sum + b.participants, 0);
      const bookedGuests = bookedGuestCounts(bookings);
      if (input.actualGuests && (input.actualParticipants !== input.actualGuests.adults + input.actualGuests.children + input.actualGuests.infants ||
        (['adults', 'children', 'infants'] as const).some(key => !Number.isInteger(input.actualGuests![key]) || input.actualGuests![key] < 0 || input.actualGuests![key] > bookedGuests[key]))) {
        throw AppError.badRequest('Số khách thực tế của từng nhóm không được vượt quá số đã đặt.');
      }
      const attendance = new Map<string, number | null>(input.attendance.map(a => [a.bookingId, a.attendedCount]));
      if (aggregate) {
        if (!Number.isInteger(input.actualParticipants) || input.actualParticipants! < 0 || input.actualParticipants! > bookedTotal || input.attendance.length) {
          throw AppError.badRequest('Tổng khách thực tế phải từ 0 đến tổng khách đã đặt.');
        }
        // A partial total cannot identify which booking was absent. Never allocate it arbitrarily.
        for (const booking of bookings) attendance.set(booking.id,
          input.actualParticipants === 0 ? 0 : input.actualParticipants === bookedTotal ? booking.participants : null);
      }
      if (!aggregate && (attendance.size !== input.attendance.length || input.attendance.some(a => !bookings.some(b => b.id === a.bookingId && a.attendedCount <= b.participants)))) {
        throw AppError.badRequest('Số khách tham gia không hợp lệ hoặc booking không thuộc đợt này.');
      }
      if (submit && bookings.some(b => !attendance.has(b.id))) throw AppError.badRequest('Hãy xác nhận số khách thực tế cho tất cả booking.');
      if (submit && (aggregate ? input.actualParticipants !== bookedTotal : bookings.some(b => attendance.get(b.id) !== b.participants)) && (input.absenceReason !== undefined ? input.absenceReason.length < 10 : input.incidents.length < 10)) throw AppError.badRequest('Hãy ghi rõ lý do khách vắng mặt và phương án xử lý (ít nhất 10 ký tự).');
      const previous = completion.completedAt ? await tx.tourCompletionReport.findFirst({ where: { completionId: completion.id, submitted: true }, orderBy: { revision: 'desc' } }) : null;
      const before = previous?.payload as { actualParticipants?: number; actualGuests?: unknown; attendance?: { attendedCount: number | null }[] } | undefined;
      const revision = completion.revision + 1;
      const report = await tx.tourCompletionReport.create({ data: { completionId: completion.id, revision,
        actorId: actor.userId, submitted: submit, payload: json({ ...input,
          bookedParticipants: bookedTotal,
          bookedGuests,
          bookedServices,
          // Booking references preserve the database report guard; null means attendance is unknown per booking.
          ...(aggregate ? { attendance: bookings.map(b => ({ bookingId: b.id, attendedCount: attendance.get(b.id) })) } : {}),
        }) } });
      const completedIds: string[] = [];
      if (submit && !completion.completedAt) {
        for (const booking of bookings.filter(b => b.status === 'CONFIRMED')) {
          const updated = await tx.booking.updateMany({ where: { id: booking.id, status: 'CONFIRMED' }, data: {
            status: 'COMPLETED', completedAt: now, attendedParticipants: attendance.get(booking.id)!,
          } });
          if (updated.count !== 1) throw AppError.conflict('Booking vừa thay đổi. Hãy tải lại báo cáo.', 'CONCURRENT_UPDATE');
          completedIds.push(booking.id);
        }
        const guide = departure.tour.guideAssignment;
        await tx.tourCompletionDelivery.createMany({ data: completedIds.map(bookingId => ({ completionId: completion.id, bookingId,
          guideId: guide?.status === 'ACCEPTED' ? guide.guideId : null, guideFee: guide?.status === 'ACCEPTED' ? guide.feePerBooking : null })) });
        await tx.tourDeparture.update({ where: { id: departureId }, data: { isOpen: false } });
      }
      if (submit && completion.completedAt) {
        // Correct live attendance only for bookings completed by this report workflow.
        // Keep historical booking state, completion time, tickets, earnings and delivery records intact.
        const managed = await tx.tourCompletionDelivery.findMany({ where: { completionId: completion.id }, select: { bookingId: true } });
        const managedIds = new Set(managed.map(row => row.bookingId));
        for (const booking of bookings.filter(b => b.status === 'COMPLETED' && managedIds.has(b.id))) {
          await tx.booking.updateMany({ where: { id: booking.id, status: 'COMPLETED' }, data: { attendedParticipants: attendance.get(booking.id) ?? null } });
        }
      }
      await tx.tourCompletion.update({ where: { id: completion.id }, data: { revision, ...(submit && !completion.completedAt ? { completedAt: now } : {}) } });
      await writeAudit(tx, { actorId: actor.userId, actorRole: actor.role,
        action: !submit ? 'tour.completion_drafted' : completion.completedAt ? 'tour.completion_amended' : 'tour.completion_submitted',
        targetType: 'tour-completion', targetId: completion.id,
        metadata: { agencyId: actor.agencyId, tourId, departureId, reportId: report.id, beforeRevision: completion.revision,
          revision, completedBookingIds: completedIds, reason: input.amendmentReason || 'Báo cáo kết thúc chuyến đi',
          attendanceBefore: before ? { total: before.actualParticipants ?? before.attendance?.reduce((sum, a) => sum + (a.attendedCount ?? 0), 0), guests: before.actualGuests ?? null } : null,
          attendanceAfter: { total: input.actualParticipants ?? input.attendance.reduce((sum, a) => sum + a.attendedCount, 0), guests: input.actualGuests ?? null },
        } });
      return detail(tx, actor.agencyId, tourId, departureId);
    });
  },
};
