import type { RequestHandler } from 'express';
import { performance } from 'node:perf_hooks';
import { userActor } from '../../middlewares/authorize';
import { sendOk } from '../../utils/api-response';
import { dashboardsService, type DashboardsService } from './dashboards.service';

/** HTTP only. The agency dashboard is always scoped to the authenticated agency. */
export class DashboardsController {
  constructor(private readonly service: DashboardsService = dashboardsService) {}

  agency: RequestHandler = async (req, res) => {
    const startedAt = performance.now();
    const dashboard = await this.service.agencyDashboard(userActor(req).userId);
    res.setHeader('Server-Timing', `agency-dashboard-service;dur=${(performance.now() - startedAt).toFixed(1)}`);
    sendOk(res, dashboard);
  };

  moderation: RequestHandler = async (_req, res) => {
    sendOk(res, await this.service.moderationDashboard());
  };

  admin: RequestHandler = async (_req, res) => {
    sendOk(res, await this.service.adminDashboard());
  };
}

export const dashboardsController = new DashboardsController();
