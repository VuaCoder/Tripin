import type { RequestHandler } from 'express';
import { userActor } from '../../middlewares/authorize';
import { sendOk } from '../../utils/api-response';
import { dashboardsService, type DashboardsService } from './dashboards.service';

/** HTTP only. The agency dashboard is always scoped to the authenticated agency. */
export class DashboardsController {
  constructor(private readonly service: DashboardsService = dashboardsService) {}

  agency: RequestHandler = async (req, res) => {
    sendOk(res, await this.service.agencyDashboard(userActor(req).userId));
  };

  moderation: RequestHandler = async (_req, res) => {
    sendOk(res, await this.service.moderationDashboard());
  };

  admin: RequestHandler = async (_req, res) => {
    sendOk(res, await this.service.adminDashboard());
  };
}

export const dashboardsController = new DashboardsController();
