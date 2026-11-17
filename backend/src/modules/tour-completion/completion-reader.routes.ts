import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '@travel-platform/constants';
import { prisma } from '../../config/database';
import { Prisma as SQL } from '../../generated/prisma/client';
import { requirePermission, userActor } from '../../middlewares/authorize';
import { validate, validated } from '../../middlewares/validate';
import { idSchema } from '../../utils/id';
import { AppError } from '../../utils/app-error';
import { sendOk } from '../../utils/api-response';
import type { CompletionReportInput } from './completion.validation';
import type { bookedCompletionServices } from './completion.services';

export const completionReaderRouter = Router();
completionReaderRouter.use(requirePermission(PERMISSIONS.TOUR_COMPLETION_VIEW));
completionReaderRouter.use((req, _res, next) => ['MODERATOR', 'SUPER_ADMIN'].includes(userActor(req).role)
  ? next() : next(AppError.forbidden('Chỉ nhân viên kiểm duyệt được xem báo cáo nội bộ.')));
const querySchema = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1),
  q: z.string().trim().max(200).optional(), agency: z.string().trim().max(200).optional(), agencyId: idSchema.optional(),
  from: z.coerce.date().optional(), to: z.coerce.date().optional(),
}).refine(q => !q.from || !q.to || q.from <= q.to, 'Khoảng thời gian không hợp lệ');
const idParams = z.object({ id: idSchema });

const agenciesQuery = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), q: z.string().trim().max(200).optional() });
const agencySelect = { id: true, companyName: true, address: true, verificationStatus: true, user: { select: { fullName: true, avatarUrl: true } } } as const;
// Start from AgencyProfile, so agencies without submitted reports are included too.
completionReaderRouter.get('/agencies', validate({ query: agenciesQuery }), async (req, res) => {
  const { query } = validated<unknown, z.infer<typeof agenciesQuery>>(req);
  const where = query.q ? { OR: [{ companyName: { contains: query.q, mode: 'insensitive' as const } }, { user: { fullName: { contains: query.q, mode: 'insensitive' as const } } }] } : {};
  const [agencies, total] = await Promise.all([
    prisma.agencyProfile.findMany({ where, select: agencySelect, orderBy: [{ companyName: 'asc' }, { id: 'asc' }], skip: (query.page - 1) * 20, take: 20 }),
    prisma.agencyProfile.count({ where }),
  ]);
  const counts = await prisma.tourCompletion.groupBy({ by: ['agencyId'], where: { agencyId: { in: agencies.map(a => a.id) }, completedAt: { not: null }, reports: { some: { submitted: true } } }, _count: { id: true }, _max: { completedAt: true } });
  sendOk(res, { items: agencies.map(a => {
    const stats = counts.find(c => c.agencyId === a.id);
    return { id: a.id, name: a.companyName || a.user?.fullName || 'Agency chưa đặt tên', avatarUrl: a.user?.avatarUrl ?? null, address: a.address, verified: a.verificationStatus === 'VERIFIED', reportCount: stats?._count.id ?? 0, lastCompletedAt: stats?._max.completedAt ?? null };
  }), total, page: query.page, totalPages: Math.ceil(total / 20) });
});

completionReaderRouter.get('/agencies/:id', validate({ params: idParams }), async (req, res) => {
  const { params } = validated<unknown, unknown, { id: string }>(req);
  const agency = await prisma.agencyProfile.findUnique({ where: { id: params.id }, select: agencySelect });
  if (!agency) throw AppError.notFound('Không tìm thấy agency.');
  const stats = await prisma.tourCompletion.aggregate({ where: { agencyId: agency.id, completedAt: { not: null }, reports: { some: { submitted: true } } }, _count: { id: true }, _max: { completedAt: true } });
  sendOk(res, { id: agency.id, name: agency.companyName || agency.user?.fullName || 'Agency chưa đặt tên', avatarUrl: agency.user?.avatarUrl ?? null,
    address: agency.address, verified: agency.verificationStatus === 'VERIFIED', reportCount: stats._count.id, lastCompletedAt: stats._max.completedAt });
});

/** Deliberately separate read model: no drafts, booking contacts, passenger papers or mutable agency endpoints. */
async function readSubmitted(id: string) {
  const row = await prisma.tourCompletion.findFirst({ where: { id, completedAt: { not: null }, reports: { some: { submitted: true } } },
    include: { reports: { where: { submitted: true }, orderBy: { revision: 'desc' } } } });
  if (!row) throw AppError.notFound('Chưa có báo cáo đã gửi cho chuyến đi này.');
  const [agency, authors, booked] = await Promise.all([
    prisma.agencyProfile.findUnique({ where: { id: row.agencyId }, select: { companyName: true } }),
    prisma.user.findMany({ where: { id: { in: row.reports.map(r => r.actorId) } }, select: { id: true, fullName: true } }),
    prisma.booking.aggregate({ where: { agencyId: row.agencyId, tourId: row.tourId, departureId: row.departureId, status: 'COMPLETED' }, _sum: { participants: true } }),
  ]);
  const snapshot = row.snapshot as { title: string; departureAt: string; durationDays: number; itinerary: unknown };
  return { id: row.id, tourId: row.tourId, departureId: row.departureId, agencyId: row.agencyId,
    agencyName: agency?.companyName ?? 'Agency', title: snapshot.title, departureAt: snapshot.departureAt,
    durationDays: snapshot.durationDays, itinerary: snapshot.itinerary, scheduledEndAt: row.scheduledEndAt,
    completedAt: row.completedAt, bookedParticipants: booked._sum.participants ?? 0,
    reports: row.reports.map(r => {
      const p = r.payload as unknown as CompletionReportInput;
      return { id: r.id, revision: r.revision, createdAt: r.createdAt, authorName: authors.find(a => a.id === r.actorId)?.fullName ?? 'Tài khoản đã ngừng hoạt động',
        actualEndAt: p.actualEndAt, summary: p.summary, changes: p.changes, incidents: p.incidents,
        services: p.services, noChanges: p.noChanges, noIncidents: p.noIncidents,
        serviceConfirmations: p.serviceConfirmations, bookedServices: (p as typeof p & { bookedServices?: ReturnType<typeof bookedCompletionServices> }).bookedServices,
        absenceReason: p.absenceReason, additionalNotes: p.additionalNotes,
        actualGuests: p.actualGuests, bookedGuests: (p as typeof p & { bookedGuests?: unknown }).bookedGuests,
        evidence: p.evidence.filter(url => /^https:\/\//i.test(url)), amendmentReason: p.amendmentReason,
        bookingCount: p.attendance.length, attendedCount: p.actualParticipants ?? p.attendance.reduce((sum, a) => sum + (a.attendedCount ?? 0), 0) };
    }) };
}

completionReaderRouter.get('/', validate({ query: querySchema }), async (req, res) => {
  const { query } = validated<unknown, z.infer<typeof querySchema>>(req);
  // Explicit Vietnamese folding also works on PostgreSQL databases using the C locale.
  const upper = 'ĐÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴ';
  const lower = upper.toLocaleLowerCase('vi');
  const pattern = (value: string) => `%${value.normalize('NFC').toLocaleLowerCase('vi').replace(/[\\%_]/g, '\\$&')}%`;
  const where = SQL.sql`c."completedAt" IS NOT NULL
    AND EXISTS (SELECT 1 FROM "TourCompletionReport" r WHERE r."completionId" = c.id AND r.submitted)
    ${query.agencyId ? SQL.sql`AND c."agencyId" = ${query.agencyId}::uuid` : SQL.empty}
    ${query.from ? SQL.sql`AND c."completedAt" >= ${query.from}` : SQL.empty}
    ${query.to ? SQL.sql`AND c."completedAt" <= ${query.to}` : SQL.empty}
    ${query.q ? SQL.sql`AND lower(translate(normalize(c.snapshot->>'title', NFC), ${upper}, ${lower})) LIKE ${pattern(query.q)}` : SQL.empty}
    ${query.agency ? SQL.sql`AND lower(translate(normalize(a."companyName", NFC), ${upper}, ${lower})) LIKE ${pattern(query.agency)}` : SQL.empty}`;
  const [rows, totals] = await Promise.all([
    prisma.$queryRaw<unknown[]>(SQL.sql`SELECT c.id, c.snapshot->>'title' AS title, c.snapshot->>'departureAt' AS "departureAt",
      c."tourId", c."departureId", (t.images)[1] AS "coverImage", t.destination,
      COALESCE((c.snapshot->>'durationDays')::integer, t."durationDays") AS "durationDays", c."scheduledEndAt" AS "endAt",
      booked."bookingCount", booked.participants,
      c."agencyId", COALESCE(a."companyName", 'Agency') AS "agencyName", c."completedAt",
      latest."createdAt" AS "latestSubmittedAt", COALESCE(u."fullName", 'Tài khoản đã ngừng hoạt động') AS "authorName",
      (SELECT COUNT(*) > 1 FROM "TourCompletionReport" r WHERE r."completionId" = c.id AND r.submitted) AS "hasAmendment"
      FROM "TourCompletion" c LEFT JOIN "AgencyProfile" a ON a.id = c."agencyId"
      LEFT JOIN "Tour" t ON t.id = c."tourId" AND t."agencyId" = c."agencyId"
      LEFT JOIN LATERAL (SELECT COUNT(*)::integer AS "bookingCount", COALESCE(SUM(b.participants), 0)::integer AS participants
        FROM "Booking" b WHERE b."agencyId" = c."agencyId" AND b."tourId" = c."tourId" AND b."departureId" = c."departureId" AND b.status = 'COMPLETED') booked ON TRUE
      JOIN LATERAL (SELECT "actorId", "createdAt" FROM "TourCompletionReport" r WHERE r."completionId" = c.id AND r.submitted ORDER BY revision DESC LIMIT 1) latest ON TRUE
      LEFT JOIN "User" u ON u.id = latest."actorId" WHERE ${where}
      ORDER BY c."completedAt" DESC, c.id DESC LIMIT 20 OFFSET ${(query.page - 1) * 20}`),
    prisma.$queryRaw<{ total: number }[]>(SQL.sql`SELECT COUNT(*)::integer AS total FROM "TourCompletion" c LEFT JOIN "AgencyProfile" a ON a.id = c."agencyId" WHERE ${where}`),
  ]);
  const total = totals[0]?.total ?? 0;
  sendOk(res, { items: rows, page: query.page, total, totalPages: Math.ceil(total / 20) });
});
completionReaderRouter.get('/by-booking/:id', validate({ params: idParams }), async (req, res) => {
  const { params } = validated<unknown, unknown, { id: string }>(req);
  const booking = await prisma.booking.findUnique({ where: { id: params.id }, select: { departureId: true, agencyId: true, tourId: true } });
  const completion = booking && await prisma.tourCompletion.findFirst({ where: { departureId: booking.departureId, agencyId: booking.agencyId, tourId: booking.tourId }, select: { id: true } });
  if (!completion) throw AppError.notFound('Chưa có báo cáo đã gửi cho chuyến đi này.');
  sendOk(res, await readSubmitted(completion.id));
});
completionReaderRouter.get('/:id', validate({ params: idParams }), async (req, res) => {
  const { params } = validated<unknown, unknown, { id: string }>(req);
  sendOk(res, await readSubmitted(params.id));
});
