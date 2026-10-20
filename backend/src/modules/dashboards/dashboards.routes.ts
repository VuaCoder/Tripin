import { Router } from 'express';
import { PERMISSIONS } from '@travel-platform/constants';
import { requirePermission, requireSuperAdmin } from '../../middlewares/authorize';
import { dashboardsController } from './dashboards.controller';
import { validate } from '../../middlewares/validate';
import { adminDashboardQuery } from './dashboards.validation';

/** Mounted at /api/v1/agency/dashboard */
export const agencyDashboardRouter = Router();
agencyDashboardRouter.get('/', requirePermission(PERMISSIONS.AGENCY_DASHBOARD_VIEW), dashboardsController.agency);

/** Mounted at /api/v1/moderation/dashboard */
export const moderationDashboardRouter = Router();
moderationDashboardRouter.get('/', requirePermission(PERMISSIONS.MODERATION_DASHBOARD_VIEW), dashboardsController.moderation);

/** Mounted at /api/v1/admin/dashboard */
export const adminDashboardRouter = Router();
adminDashboardRouter.use(requireSuperAdmin);
adminDashboardRouter.get('/', requirePermission(PERMISSIONS.ADMIN_DASHBOARD_VIEW), validate({ query: adminDashboardQuery }), dashboardsController.admin);
