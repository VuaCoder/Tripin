import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { resolvePermissions, type Role } from '@travel-platform/constants';
import { errorHandler } from '../../../middlewares/error-handler';
import { GUEST_ACTOR } from '../../../types/actor';

const agencyDashboard = vi.fn(async (agencyId: string) => ({ agencyId }));
vi.mock('../dashboards.service', () => ({
  DashboardsService: class {},
  dashboardsService: {
    agencyDashboard: (id: string) => agencyDashboard(id),
    moderationDashboard: async () => ({ queues: {} }),
    adminDashboard: async () => ({ users: {} }),
  },
}));

import { adminDashboardRouter, agencyDashboardRouter, moderationDashboardRouter } from '../dashboards.routes';

function app() {
  const server = express();
  server.use((req, _res, next) => {
    const role = req.header('x-role') as Role | undefined;
    req.actor = role
      ? { kind: 'user', userId: req.header('x-user') ?? 'u1', email: 'x@y.z', role: role as never, permissions: resolvePermissions(role) }
      : GUEST_ACTOR;
    next();
  });
  server.use('/agency/dashboard', agencyDashboardRouter);
  server.use('/moderation/dashboard', moderationDashboardRouter);
  server.use('/admin/dashboard', adminDashboardRouter);
  server.use(errorHandler);
  return server;
}

const get = (path: string, role?: string, user?: string) => {
  const r = request(app()).get(path);
  if (role) r.set('x-role', role);
  if (user) r.set('x-user', user);
  return r;
};

describe('dashboard authorization', () => {
  it.each([
    ['/agency/dashboard', ['AGENCY'], ['TRAVELER', 'TOUR_GUIDE', 'MODERATOR']],
    ['/moderation/dashboard', ['MODERATOR', 'SUPER_ADMIN'], ['TRAVELER', 'AGENCY', 'TOUR_GUIDE']],
    ['/admin/dashboard', ['SUPER_ADMIN'], ['TRAVELER', 'AGENCY', 'TOUR_GUIDE', 'MODERATOR']],
  ])('%s', async (path, allowed, denied) => {
    expect((await get(path)).status).toBe(401);
    for (const role of allowed) expect((await get(path, role)).status).toBe(200);
    for (const role of denied) expect((await get(path, role)).status).toBe(403);
  });

  it('the agency dashboard is computed for the authenticated agency only (no id parameter exists)', async () => {
    const res = await get('/agency/dashboard', 'AGENCY', 'agency-77');
    expect(res.body.data).toEqual({ agencyId: 'agency-77' });
    expect((await get('/agency/dashboard/other-agency', 'AGENCY', 'agency-77')).status).toBe(404);
  });
});
