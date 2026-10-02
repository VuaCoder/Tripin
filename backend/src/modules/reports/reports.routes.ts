import { Router } from 'express';
import { PERMISSIONS } from '@travel-platform/constants';
import { requirePermission } from '../../middlewares/authorize';
import { createRateLimiter } from '../../middlewares/rate-limit';
import { validate } from '../../middlewares/validate';
import { reportsController } from './reports.controller';
import { createReportBody, listReportsQuery, reportIdParams, respondBody } from './reports.validation';

const createLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, limit: 20 });
const P = PERMISSIONS;

/** Mounted at /api/v1/reports — the logged-in traveler's reports ("Send report"). */
export const reportsRouter = Router();
reportsRouter.use(requirePermission(P.REPORT_CREATE));
reportsRouter.post('/', createLimiter, validate({ body: createReportBody }), reportsController.create);
// '/me' is declared before '/:id'.
reportsRouter.get('/me', validate({ query: listReportsQuery }), reportsController.listMine);
reportsRouter.get('/:id', validate({ params: reportIdParams }), reportsController.getMine);

/** Mounted at /api/v1/agency/complaints — reports routed to the logged-in agency ("Handle tour complaints"). */
export const agencyComplaintsRouter = Router();
agencyComplaintsRouter.use(requirePermission(P.COMPLAINT_RESPOND));
agencyComplaintsRouter.get('/', validate({ query: listReportsQuery }), reportsController.listComplaints);
agencyComplaintsRouter.get('/:id', validate({ params: reportIdParams }), reportsController.getComplaint);
agencyComplaintsRouter.post('/:id/respond', validate({ params: reportIdParams, body: respondBody }), reportsController.respond);
