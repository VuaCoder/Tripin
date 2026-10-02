import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { resolvePermissions, type Role } from '@travel-platform/constants';
import { GUEST_ACTOR } from '../../../types/actor';
import { errorHandler } from '../../../middlewares/error-handler';

// Replace the service singleton so the HTTP layer is tested without any database.
vi.mock('../moderation.service', () => {
  const ok = vi.fn(async () => ({ ok: true }));
  const page = vi.fn(async () => ({ items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } }));
  return {
    ModerationService: class {},
    moderationService: {
      listTours: page, getTour: ok, validateTour: ok, suspendTour: ok,
      listAgencies: page, verifyAgency: ok,
      listReviews: page, moderateReview: ok,
      banUser: ok, unbanUser: ok,
      listReports: page, getReport: ok, resolveReport: ok,
      listTickets: page, getTicket: ok, replyToTicket: ok, setTicketStatus: ok,
    },
  };
});

import { moderationRouter } from '../moderation.routes';

const ID = '11111111-1111-4111-8111-111111111111';

function app() {
  const server = express();
  server.use(express.json());
  // Stand-in for `authenticate`: the role comes from a test header, permissions from the REAL role table.
  server.use((req, _res, next) => {
    const role = req.header('x-role') as Role | undefined;
    req.actor = role
      ? { kind: 'user', userId: 'u1', email: 'x@y.z', role: role as never, permissions: resolvePermissions(role) }
      : GUEST_ACTOR;
    next();
  });
  server.use('/moderation', moderationRouter);
  server.use(errorHandler);
  return server;
}

type Route = { method: 'get' | 'post' | 'patch'; path: string; body?: object };
const routes: Route[] = [
  { method: 'get', path: '/moderation/tours' },
  { method: 'get', path: `/moderation/tours/${ID}` },
  { method: 'post', path: `/moderation/tours/${ID}/validate`, body: { approve: true } },
  { method: 'post', path: `/moderation/tours/${ID}/suspend`, body: { reason: 'complaints' } },
  { method: 'get', path: '/moderation/agencies' },
  { method: 'post', path: `/moderation/agencies/${ID}/verify`, body: { approve: true } },
  { method: 'get', path: '/moderation/reviews' },
  { method: 'post', path: `/moderation/reviews/${ID}/moderate`, body: { hide: true, reason: 'abuse' } },
  { method: 'post', path: `/moderation/users/${ID}/ban`, body: { reason: 'spam' } },
  { method: 'post', path: `/moderation/users/${ID}/unban` },
  { method: 'get', path: '/moderation/reports' },
  { method: 'get', path: `/moderation/reports/${ID}` },
  { method: 'post', path: `/moderation/reports/${ID}/resolve`, body: { decision: 'RESOLVED', note: 'done' } },
  { method: 'get', path: '/moderation/support-tickets' },
  { method: 'get', path: `/moderation/support-tickets/${ID}` },
  { method: 'post', path: `/moderation/support-tickets/${ID}/reply`, body: { text: 'hello' } },
  { method: 'patch', path: `/moderation/support-tickets/${ID}/status`, body: { status: 'RESOLVED' } },
];

const call = (route: Route, role?: string) => {
  const r = request(app())[route.method](route.path);
  if (role) r.set('x-role', role);
  return route.body ? r.send(route.body) : r;
};

describe('moderation routes: authorization matrix', () => {
  it.each(routes)('$method $path -> guest 401, traveler/agency/guide 403, moderator & super admin allowed', async (route) => {
    expect((await call(route)).status).toBe(401);
    for (const role of ['TRAVELER', 'AGENCY', 'TOUR_GUIDE']) expect((await call(route, role)).status).toBe(403);
    for (const role of ['MODERATOR', 'SUPER_ADMIN']) expect((await call(route, role)).status).toBe(200);
  });
});

describe('moderation routes: validation', () => {
  it('rejects bad ids, missing reasons and unknown fields before reaching the service', async () => {
    const as = (r: request.Test) => r.set('x-role', 'MODERATOR');
    expect((await as(request(app()).get('/moderation/tours/not-an-id'))).status).toBe(400);
    expect((await as(request(app()).post(`/moderation/tours/${ID}/validate`).send({ approve: false }))).status).toBe(400);
    expect((await as(request(app()).post(`/moderation/tours/${ID}/suspend`).send({}))).status).toBe(400);
    expect((await as(request(app()).post(`/moderation/users/${ID}/ban`).send({ reason: 'x' }))).status).toBe(400);
    expect((await as(request(app()).post(`/moderation/reviews/${ID}/moderate`).send({ hide: true }))).status).toBe(400);
    expect((await as(request(app()).post(`/moderation/reports/${ID}/resolve`).send({ decision: 'MAYBE', note: 'abc' }))).status).toBe(400);
    expect((await as(request(app()).post(`/moderation/support-tickets/${ID}/reply`).send({ text: 'hello', extra: 1 }))).status).toBe(400);
    expect((await as(request(app()).get('/moderation/tours?limit=1000'))).status).toBe(400);
  });
});
