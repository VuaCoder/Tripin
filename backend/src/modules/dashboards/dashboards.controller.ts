import type { RequestHandler } from 'express';
import { userActor } from '../../middlewares/authorize';
import { sendOk } from '../../utils/api-response';
import { dashboardsService, type DashboardsService } from './dashboards.service';
import { validated } from '../../middlewares/validate';
import type { AdminDashboardQuery } from './dashboards.validation';

/** HTTP only. The agency dashboard is always scoped to the authenticated agency. */
export class DashboardsController {
  constructor(private readonly service: DashboardsService = dashboardsService) {}

  agency: RequestHandler = async (req, res) => {
    sendOk(res, await this.service.agencyDashboard(userActor(req).userId));
  };

  moderation: RequestHandler = async (_req, res) => {
    sendOk(res, await this.service.moderationDashboard());
  };

  admin: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, AdminDashboardQuery>(req);
    sendOk(res, await this.service.adminDashboard(query.from && query.to ? { from: query.from, to: query.to } : undefined));
  };
}

export const dashboardsController = new DashboardsController();
