import { Router } from 'express';
import { PERMISSIONS } from '@travel-platform/constants';
import { requirePermission } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { earningsController } from './earnings.controller';
import { listEarningsQuery, summaryQuery } from './earnings.validation';

/** Mounted at /api/v1/earnings — the logged-in tour guide's earnings. */
export const earningsRouter = Router();
earningsRouter.use(requirePermission(PERMISSIONS.EARNINGS_VIEW));
earningsRouter.get('/me', validate({ query: listEarningsQuery }), earningsController.list);
earningsRouter.get('/me/summary', validate({ query: summaryQuery }), earningsController.summary);
