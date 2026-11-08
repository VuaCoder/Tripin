import { Router } from 'express';
import { PERMISSIONS } from '@travel-platform/constants';
import { requirePermission, userActor } from '../../middlewares/authorize';
import { z } from 'zod';
import { validated } from '../../middlewares/validate';
import { idParamsSchema } from '../../utils/id';
import { sendOk } from '../../utils/api-response';
import { AppError } from '../../utils/app-error';
import { earningsService } from './earnings.service';
import { validate } from '../../middlewares/validate';
import { earningsController } from './earnings.controller';
import { listEarningsQuery, summaryQuery } from './earnings.validation';

/** Mounted at /api/v1/earnings — the logged-in tour guide's earnings. */
export const earningsRouter = Router();
earningsRouter.post('/payouts/:id/transfer', requirePermission(PERMISSIONS.TOUR_UPDATE_OWN), validate({ params: idParamsSchema, body: z.object({ transferReference: z.string().trim().min(3).max(120) }).strict() }), async (req, res) => {
  const actor = userActor(req);
  if (actor.role !== 'AGENCY') throw AppError.forbidden('Only the paying agency can record a transfer');
  const { params, body } = validated<{ transferReference: string }, unknown, { id: string }>(req);
  sendOk(res, await earningsService.recordTransfer(actor.userId, params.id, body.transferReference));
});
earningsRouter.use(requirePermission(PERMISSIONS.EARNINGS_VIEW));
earningsRouter.get('/me', validate({ query: listEarningsQuery }), earningsController.list);
earningsRouter.get('/me/ledger', validate({ query: listEarningsQuery }), earningsController.list);
earningsRouter.get('/me/summary', validate({ query: summaryQuery }), earningsController.summary);
