import { Router } from 'express';
import { PERMISSIONS } from '@travel-platform/constants';
import { requirePermission, requireSuperAdmin } from '../../middlewares/authorize';
import { requireAgencyPermission } from '../../middlewares/agency-context';
import { AGENCY_PERMISSIONS } from '../agencies/agency.policy';
import { validate } from '../../middlewares/validate';
import { agencyCommissionController } from './agency-commission.controller';
import {
  approveCommissionRequestBody,
  commissionRequestIdParams,
  createCommissionRequestBody,
  listCommissionRequestsQuery,
  rejectCommissionRequestBody,
} from './agency-commission.validation';

/** Mounted at /api/v1/agency/commission — the agency reads its share and its owner requests a change. */
export const agencyCommissionRouter = Router();
agencyCommissionRouter.get('/', requireAgencyPermission(AGENCY_PERMISSIONS.CONTEXT_VIEW), agencyCommissionController.overview);
agencyCommissionRouter.post(
  '/requests',
  requireAgencyPermission(AGENCY_PERMISSIONS.FINANCE_MANAGE),
  validate({ body: createCommissionRequestBody }),
  agencyCommissionController.create,
);
agencyCommissionRouter.post(
  '/requests/:id/cancel',
  requireAgencyPermission(AGENCY_PERMISSIONS.FINANCE_MANAGE),
  validate({ params: commissionRequestIdParams }),
  agencyCommissionController.cancel,
);

/** Mounted at /api/v1/admin/settings/agency-commission-requests — Super Admin review queue. */
export const adminAgencyCommissionRequestsRouter = Router();
adminAgencyCommissionRequestsRouter.use(requireSuperAdmin, requirePermission(PERMISSIONS.COMMISSION_CONFIGURE));
adminAgencyCommissionRequestsRouter.get('/', validate({ query: listCommissionRequestsQuery }), agencyCommissionController.adminList);
adminAgencyCommissionRequestsRouter.post(
  '/:id/approve',
  validate({ params: commissionRequestIdParams, body: approveCommissionRequestBody }),
  agencyCommissionController.approve,
);
adminAgencyCommissionRequestsRouter.post(
  '/:id/reject',
  validate({ params: commissionRequestIdParams, body: rejectCommissionRequestBody }),
  agencyCommissionController.reject,
);
