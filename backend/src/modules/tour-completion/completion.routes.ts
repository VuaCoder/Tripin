import { Router } from 'express';
import { PERMISSIONS } from '@travel-platform/constants';
import { requirePermission, userActor } from '../../middlewares/authorize';
import { agencyContext } from '../../middlewares/agency-context';
import { validate, validated } from '../../middlewares/validate';
import { sendOk } from '../../utils/api-response';
import { AppError } from '../../utils/app-error';
import { completionService } from './completion.service';
import { completionParams, reportBody, type CompletionReportInput } from './completion.validation';
import { prisma } from '../../config/database';
import { z } from 'zod';

export const completionRouter = Router();
completionRouter.use(requirePermission(PERMISSIONS.TOUR_UPDATE_OWN));
completionRouter.use((req, _res, next) => agencyContext(req).memberRole === 'OWNER' || agencyContext(req).memberRole === 'MANAGER'
  ? next() : next(AppError.forbidden('Chỉ chủ sở hữu hoặc quản lý được chốt báo cáo chuyến đi.')));
type Params = { tourId: string; departureId: string };
export const completionQueueRouter = Router();
const queueQuery = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), status: z.enum(['pending', 'completed']).default('pending') });
completionQueueRouter.get('/', requirePermission(PERMISSIONS.TOUR_UPDATE_OWN), validate({ query: queueQuery }), async (req, res) => {
  const ctx = agencyContext(req);
  if (!['OWNER', 'MANAGER'].includes(ctx.memberRole)) throw AppError.forbidden();
  const { query } = validated<unknown, z.infer<typeof queueQuery>>(req);
  if (query.status === 'completed') {
    const rows = await prisma.$queryRaw<{ departureId: string; tourId: string; title: string; departureAt: Date; endAt: Date; completedAt: Date | null; bookingCount: number; participants: number; hasReport: boolean }[]>`
      SELECT b."departureId", b."tourId", t.title, (t.images)[1] AS "coverImage", t.destination, t."durationDays", MIN(b."departureDate") AS "departureAt", MAX(b."endDate") AS "endAt",
        COALESCE(c."completedAt", MAX(b."completedAt")) AS "completedAt",
        COUNT(*)::integer AS "bookingCount", SUM(b.participants)::integer AS participants,
        EXISTS (SELECT 1 FROM "TourCompletionReport" r WHERE r."completionId" = c.id AND r.submitted) AS "hasReport"
      FROM "Booking" b JOIN "Tour" t ON t.id = b."tourId" AND t."agencyId" = b."agencyId"
      LEFT JOIN "TourCompletion" c ON c."departureId" = b."departureId" AND c."tourId" = b."tourId" AND c."agencyId" = b."agencyId"
      WHERE b."agencyId" = ${ctx.agencyId}::uuid AND b.status = 'COMPLETED'
      GROUP BY b."departureId", b."tourId", t.title, t.images, t.destination, t."durationDays", c.id
      ORDER BY "completedAt" DESC NULLS LAST, b."departureId" LIMIT 21 OFFSET ${(query.page - 1) * 20}`;
    return sendOk(res, { items: rows.slice(0, 20), hasNext: rows.length > 20, page: query.page });
  }
  const rows = await prisma.$queryRaw<{ departureId: string; tourId: string; title: string; departureAt: Date; endAt: Date; bookingCount: number; participants: number }[]>`
    SELECT b."departureId", b."tourId", t.title, (t.images)[1] AS "coverImage", t.destination, t."durationDays", MIN(b."departureDate") AS "departureAt", MAX(b."endDate") AS "endAt",
      COUNT(*)::integer AS "bookingCount", SUM(b.participants)::integer AS participants
    FROM "Booking" b JOIN "Tour" t ON t.id = b."tourId"
    WHERE b."agencyId" = ${ctx.agencyId}::uuid AND t."agencyId" = ${ctx.agencyId}::uuid AND b.status = 'CONFIRMED'
    GROUP BY b."departureId", b."tourId", t.title, t.images, t.destination, t."durationDays" HAVING MAX(b."endDate") <= ${new Date()}
    ORDER BY MAX(b."endDate"), b."departureId" LIMIT 21 OFFSET ${(query.page - 1) * 20}`;
  sendOk(res, { items: rows.slice(0, 20), hasNext: rows.length > 20, page: query.page });
});
completionRouter.get('/:tourId/departures/:departureId/completion', validate({ params: completionParams }), async (req, res) => {
  const { params } = validated<unknown, unknown, Params>(req);
  sendOk(res, await completionService.get(agencyContext(req).agencyId, params.tourId, params.departureId));
});
for (const action of ['draft', 'submit'] as const) {
  completionRouter.post(`/:tourId/departures/:departureId/completion/${action}`, validate({ params: completionParams, body: reportBody }), async (req, res) => {
    const { params, body } = validated<CompletionReportInput, unknown, Params>(req);
    const actor = userActor(req);
    sendOk(res, await completionService.save({ agencyId: agencyContext(req).agencyId, userId: actor.userId, role: actor.role }, params.tourId, params.departureId, body, action === 'submit'));
  });
}
