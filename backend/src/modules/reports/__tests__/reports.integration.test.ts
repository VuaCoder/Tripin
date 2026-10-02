import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import { bearer, createApprovedTour, createUser, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';
import { prisma } from '../../../config/database';

// Real Express app + real PostgreSQL: reporting a tour, the agency's single answer, and the moderator's final decision.
const app = createApp();

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);

async function setup() {
  const agency = await createUser('AGENCY', 'agency@example.com');
  const rival = await createUser('AGENCY', 'rival@example.com');
  const traveler = await createUser('TRAVELER', 'traveler@example.com');
  const moderator = await createUser('MODERATOR', 'mod@example.com');
  const { tourId } = await createApprovedTour(agency.id);
  return { agency, rival, traveler, moderator, tourId };
}

const file = (token: string, tourId: string, overrides: object = {}) =>
  request(app)
    .post('/api/v1/reports')
    .set(bearer(token))
    .send({ targetType: 'TOUR', targetId: tourId, category: 'MISLEADING_INFO', description: 'The itinerary does not match what was sold.', ...overrides });

describe('reports (integration)', () => {
  it('routes a report to the tour owner on the server, never trusting the client', async () => {
    const { agency, traveler, tourId } = await setup();
    const res = await file(traveler.token, tourId);
    expect(res.status).toBe(201);

    const stored = (await prisma.report.findUnique({ where: { id: res.body.data.id } }))!;
    expect(String(stored.agencyId)).toBe(agency.id);
    expect(String(stored.tourId)).toBe(tourId);

    expect((await file(traveler.token, tourId, { agencyId: agency.id })).status).toBe(400); // unknown field
    expect((await file(traveler.token, '99999999-9999-4999-8999-999999999999')).status).toBe(404); // target must exist
    expect((await file(traveler.token, tourId, { description: 'short' })).status).toBe(400);
    expect((await request(app).post('/api/v1/reports').send({})).status).toBe(401);
  });

  it('allows one open report per reporter and target, even when filed twice at the same moment', async () => {
    const { traveler, tourId } = await setup();
    const results = await Promise.all(Array.from({ length: 5 }, () => file(traveler.token, tourId)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409).every((r) => r.body.error.code === 'REPORT_ALREADY_OPEN')).toBe(true);
    expect(await prisma.report.count()).toBe(1);
  });

  it('the reporter sees only their own reports; the agency sees only complaints about its tours', async () => {
    const { agency, rival, traveler, tourId } = await setup();
    const other = await createUser('TRAVELER', 'other@example.com');
    const created = await file(traveler.token, tourId);
    const id = created.body.data.id;

    expect((await request(app).get(`/api/v1/reports/${id}`).set(bearer(other.token))).status).toBe(404);
    expect((await request(app).get('/api/v1/reports/me').set(bearer(other.token))).body.data).toHaveLength(0);

    expect((await request(app).get(`/api/v1/agency/complaints/${id}`).set(bearer(rival.token))).status).toBe(404);
    expect((await request(app).get('/api/v1/agency/complaints').set(bearer(rival.token))).body.data).toHaveLength(0);
    const own = await request(app).get('/api/v1/agency/complaints').set(bearer(agency.token));
    expect(own.body.data).toHaveLength(1);
    expect(JSON.stringify(own.body)).not.toContain('traveler@example.com'); // reporter identity is limited to a name
    expect((await request(app).get('/api/v1/agency/complaints').set(bearer(traveler.token))).status).toBe(403);
  });

  it('the agency answers once; a moderator then decides once; every other order is refused', async () => {
    const { agency, rival, traveler, moderator, tourId } = await setup();
    const id = (await file(traveler.token, tourId)).body.data.id;
    const respond = (token: string) =>
      request(app).post(`/api/v1/agency/complaints/${id}/respond`).set(bearer(token)).send({ text: 'We corrected the itinerary.' });
    const resolve = (token: string, body: object) =>
      request(app).post(`/api/v1/moderation/reports/${id}/resolve`).set(bearer(token)).send(body);

    expect((await respond(rival.token)).status).toBe(404);
    const answers = await Promise.all([respond(agency.token), respond(agency.token), respond(agency.token)]);
    expect(answers.filter((r) => r.status === 200)).toHaveLength(1);

    expect((await resolve(agency.token, { decision: 'RESOLVED', note: 'I decide.' })).status).toBe(403);
    expect((await resolve(moderator.token, { decision: 'OPEN', note: 'Nope.' })).status).toBe(400);
    const decisions = await Promise.all([
      resolve(moderator.token, { decision: 'RESOLVED', note: 'Upheld, refund the traveler.' }),
      resolve(moderator.token, { decision: 'REJECTED', note: 'Not founded at all.' }),
    ]);
    expect(decisions.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await prisma.auditLog.count({ where: { action: 'report.resolved' } })).toBe(1);

    expect((await respond(agency.token)).status).toBe(409); // closed reports take no answers
    expect((await resolve(moderator.token, { decision: 'REJECTED', note: 'Changing my mind.' })).status).toBe(409);

    // A closed report no longer blocks a new one about the same tour.
    expect((await file(traveler.token, tourId)).status).toBe(201);

    const notices = await request(app).get('/api/v1/notifications').set(bearer(traveler.token));
    expect(notices.body.data.map((n: { type: string }) => n.type)).toEqual(expect.arrayContaining(['REPORT_UPDATED', 'REPORT_RESOLVED']));
  });
});
