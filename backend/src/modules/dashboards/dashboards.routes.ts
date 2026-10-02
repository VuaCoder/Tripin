import { Router } from 'express';
import { PERMISSIONS } from '@travel-platform/constants';
import { requirePermission } from '../../middlewares/authorize';
import { dashboardsController } from './dashboards.controller';

/** Mounted at /api/v1/agency/dashboard */
export const agencyDashboardRouter = Router();
agencyDashboardRouter.get('/', requirePermission(PERMISSIONS.AGENCY_DASHBOARD_VIEW), dashboardsController.agency);

/** Mounted at /api/v1/moderation/dashboard */
export const moderationDashboardRouter = Router();
moderationDashboardRouter.get('/', requirePermission(PERMISSIONS.MODERATION_DASHBOARD_VIEW), dashboardsController.moderation);

/** Mounted at /api/v1/admin/dashboard */
export const adminDashboardRouter = Router();
adminDashboardRouter.get('/', requirePermission(PERMISSIONS.ADMIN_DASHBOARD_VIEW), dashboardsController.admin);
