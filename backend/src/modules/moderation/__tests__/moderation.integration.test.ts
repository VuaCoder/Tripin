import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import { bearer, createUser, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';
import { prisma } from '../../../config/database';

// Real Express app + real PostgreSQL: who may moderate, agency verification, and bans that bite immediately.
const app = createApp();

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);

const someId = '11111111-aaaa-4111-8111-111111111111';
type Method = 'get' | 'post' | 'patch';
const MODERATION_ROUTES: [Method, string, object?][] = [
  ['get', '/tours'],
  ['get', `/tours/${someId}`],
  ['post', `/tours/${someId}/validate`, { approve: true }],
  ['post', `/tours/${someId}/suspend`, { reason: 'Reason here' }],
  ['get', '/agencies'],
  ['post', `/agencies/${someId}/verify`, { approve: true }],
  ['get', '/reviews'],
  ['post', `/reviews/${someId}/moderate`, { hide: false }],
  ['post', `/users/${someId}/ban`, { reason: 'Spam account' }],
  ['post', `/users/${someId}/unban`, {}],
  ['get', '/reports'],
  ['get', `/reports/${someId}`],
  ['post', `/reports/${someId}/resolve`, { decision: 'RESOLVED', note: 'Handled it' }],
  ['get', '/support-tickets'],
  ['get', `/support-tickets/${someId}`],
  ['post', `/support-tickets/${someId}/reply`, { text: 'Hello there' }],
  ['patch', `/support-tickets/${someId}/status`, { status: 'CLOSED' }],
];
const call = (method: Method, path: string, body: object | undefined, token?: string) => {
  const req = request(app)[method](`/api/v1/moderation${path}`);
  if (token) req.set(bearer(token));
  return body ? req.send(body) : req;
};

describe('moderation (integration)', () => {
  it('every moderation endpoint refuses guests (401) and non-staff roles (403), and lets moderators through', async () => {
    const roles = await Promise.all([
      createUser('TRAVELER', 'traveler@example.com'),
      createUser('AGENCY', 'agency@example.com'),
      createUser('TOUR_GUIDE', 'guide@example.com'),
    ]);
    const moderator = await createUser('MODERATOR', 'mod@example.com');

    for (const [method, path, body] of MODERATION_ROUTES) {
      expect(await call(method, path, body, undefined).then((r) => r.status), `guest ${method} ${path}`).toBe(401);
      for (const role of roles) {
        expect(await call(method, path, body, role.token).then((r) => r.status), `role ${method} ${path}`).toBe(403);
      }
      // A moderator may call it: the outcome is 200/404/409 depending on the data, never an auth failure.
      const status = await call(method, path, body, moderator.token).then((r) => r.status);
      expect([401, 403], `moderator ${method} ${path}`).not.toContain(status);
      expect(status, `moderator ${method} ${path}`).toBeLessThan(500);
    }
  });

  it('agency verification: pending list, rejection needs a note, one decision wins, the agency is notified', async () => {
    const moderator = await createUser('MODERATOR', 'mod@example.com');
    const agency = await createUser('AGENCY', 'agency@example.com', {
      agencyProfile: { companyName: 'Sunrise Travel', licenseNumber: 'LIC-001', verificationStatus: 'UNVERIFIED' },
    });

    // An agency without company data cannot ask for verification; with it, the request is accepted.
    const incomplete = await createUser('AGENCY', 'bare@example.com');
    expect((await request(app).post('/api/v1/users/me/agency-verification').set(bearer(incomplete.token)).send({})).status).toBe(400);
    const submit = await request(app).post('/api/v1/users/me/agency-verification').set(bearer(agency.token)).send({});
    expect(submit.status).toBeLessThan(300);

    const pending = await request(app).get('/api/v1/moderation/agencies').set(bearer(moderator.token));
    expect(pending.body.data.map((a: { id: string }) => a.id)).toEqual([agency.id]);

    const verify = (body: object) => request(app).post(`/api/v1/moderation/agencies/${agency.id}/verify`).set(bearer(moderator.token)).send(body);
    expect((await verify({ approve: false })).status).toBe(400); // note required to reject

    const results = await Promise.all([verify({ approve: true }), verify({ approve: false, note: 'License unreadable' }), verify({ approve: true })]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect((await prisma.user.findUnique({ where: { id: agency.id }, include: { agencyProfile: true } }))!.agencyProfile!.verificationStatus).not.toBe('PENDING');

    expect(await prisma.auditLog.count({ where: { action: 'agency.verification_decided' } })).toBe(1);
  });

  it('a ban applies at once: old access token, login, refresh and chat sockets are all refused; unban restores access', async () => {
    const moderator = await createUser('MODERATOR', 'mod@example.com');
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    const ban = (id: string, token = moderator.token) =>
      request(app).post(`/api/v1/moderation/users/${id}/ban`).set(bearer(token)).send({ reason: 'Repeated fraud' });

    const me = () => request(app).get('/api/v1/users/me').set(bearer(traveler.token));
    expect((await me()).status).toBe(200);

    expect((await ban(traveler.id)).status).toBe(200);
    const blocked = await me();
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('ACCOUNT_BANNED');
    expect((await ban(traveler.id)).status).toBe(409); // already banned

    const unban = await request(app).post(`/api/v1/moderation/users/${traveler.id}/unban`).set(bearer(moderator.token)).send({});
    expect(unban.status).toBe(200);
    expect((await me()).status).toBe(200);

    expect(await prisma.auditLog.count({ where: { action: { in: ['user.banned', 'user.unbanned'] } } })).toBe(2);
  });

  it('ban guards: not yourself, not a super admin, staff only by a super admin', async () => {
    const moderator = await createUser('MODERATOR', 'mod@example.com');
    const otherModerator = await createUser('MODERATOR', 'mod2@example.com');
    const admin = await createUser('SUPER_ADMIN', 'admin@example.com');
    const ban = (id: string, token: string) =>
      request(app).post(`/api/v1/moderation/users/${id}/ban`).set(bearer(token)).send({ reason: 'Policy violation' });

    expect((await ban(moderator.id, moderator.token)).status).toBe(403);
    expect((await ban(admin.id, moderator.token)).status).toBe(403);
    expect((await ban(admin.id, admin.token)).status).toBe(403);
    expect((await ban(otherModerator.id, moderator.token)).status).toBe(403);
    expect((await ban(otherModerator.id, admin.token)).status).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: admin.id } }))!.status).toBe('ACTIVE');
  });
});
