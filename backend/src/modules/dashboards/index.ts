// Public surface of dashboards (read models only).
export { agencyDashboardRouter, moderationDashboardRouter, adminDashboardRouter } from './dashboards.routes';
export { dashboardsService, DashboardsService } from './dashboards.service';
export type { AdminDashboardDto, AgencyDashboardDto, ModerationDashboardDto } from './dashboards.types';
