import { Router } from 'express';
import { PERMISSIONS } from '@travel-platform/constants';
import { requirePermission } from '../../middlewares/authorize';
import { resolveAgencyContext, requireAgencyPermission, requireVerifiedAgency } from '../../middlewares/agency-context';
import { AGENCY_PERMISSIONS } from '../agencies/agency.policy';
import { idParamsSchema } from '../../utils/id';
import { z } from 'zod';
import { AppError } from '../../utils/app-error';
import { validate } from '../../middlewares/validate';
import { earningsController } from './earnings.controller';
import { listEarningsQuery, summaryQuery } from './earnings.validation';

/** Mounted at /api/v1/earnings — the logged-in tour guide's earnings. */
export const earningsRouter = Router();
// H2.7: no global permission or legacy User.id can authorize a tenant transfer.
// Re-enable only with an approved AgencyContext finance workflow and actor audit.
earningsRouter.post('/payouts/:id/transfer', resolveAgencyContext, requireVerifiedAgency,
  requireAgencyPermission(AGENCY_PERMISSIONS.FINANCE_MANAGE),
  validate({ params: idParamsSchema, body: z.object({ transferReference: z.string().trim().min(3).max(120) }).strict() }), (_req, _res) => {
  throw new AppError(410, 'LEGACY_TRANSFER_QUARANTINED', 'Legacy transfer endpoint is quarantined');
});
earningsRouter.use(requirePermission(PERMISSIONS.EARNINGS_VIEW));
earningsRouter.get('/me', validate({ query: listEarningsQuery }), earningsController.list);
earningsRouter.get('/me/ledger', validate({ query: listEarningsQuery }), earningsController.list);
earningsRouter.get('/me/summary', validate({ query: summaryQuery }), earningsController.summary);
