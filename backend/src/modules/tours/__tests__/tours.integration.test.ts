import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import {
  bearer,
  createCategory,
  createUser,
  createVerifiedAgency,
  resetDatabase,
  startDatabase,
  stopDatabase,
  loadTour,
} from '../../../test/integration';
import { prisma } from '../../../config/database';

// Real Express app + real PostgreSQL: tour lifecycle over HTTP (agency -> moderator -> public) and inventory consistency.
const app = createApp();

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);

const day = 86_400_000;
const contact = { fullName: 'Nguyen Van A', phone: '0901234567' };
const inDays = (n: number) => new Date(Date.now() + n * day).toISOString();

async function actors() {
  const agency = await createVerifiedAgency('agency@example.com');
  const moderator = await createUser('MODERATOR', 'mod@example.com');
  const traveler = await createUser('TRAVELER', 'traveler@example.com');
  const categoryId = await createCategory();
  return { agency, moderator, traveler, categoryId };
}

async function draftTour(token: string, categoryId: string, overrides: object = {}) {
  const res = await request(app)
    .post('/api/v1/agency/tours')
    .set(bearer(token))
    .send({ title: 'Ha Long Bay 2D1N', destination: 'Quang Ninh', durationDays: 2, basePrice: 1_000_000, categoryIds: [categoryId], ...overrides });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

const setDepartures = (token: string, tourId: string, departures: object[]) =>
  request(app).put(`/api/v1/agency/tours/${tourId}/availability`).set(bearer(token)).send({ departures });

/** DRAFT -> departures -> submit -> approved by a moderator. Returns ids. */
async function approvedTour(a: Awaited<ReturnType<typeof actors>>, capacity = 5) {
  const tourId = await draftTour(a.agency.token, a.categoryId);
  const avail = await setDepartures(a.agency.token, tourId, [{ date: inDays(30), capacity, isOpen: true }]);
  expect(avail.status).toBe(200);
  expect((await request(app).post(`/api/v1/agency/tours/${tourId}/submit`).set(bearer(a.agency.token))).status).toBe(202);
  const decision = await request(app).post(`/api/v1/moderation/tours/${tourId}/validate`).set(bearer(a.moderator.token)).send({ approve: true });
  expect(decision.status).toBe(200);
  const departureId = String((await loadTour(tourId))!.departures[0]!.id);
  return { tourId, departureId };
}

const book = (token: string, tourId: string, departureId: string, participants = 1) =>
  request(app).post('/api/v1/bookings').set(bearer(token)).send({ tourId, departureId, participants, contact });

describe('tours (integration)', () => {
  it('walks the whole lifecycle: draft is private, approval publishes, an edit sends it back to review', async () => {
    const a = await actors();
    const tourId = await draftTour(a.agency.token, a.categoryId);

    // A draft is invisible to the public and to other users, visible to its owner.
    expect((await request(app).get(`/api/v1/tours/${tourId}`)).status).toBe(404);
    expect((await request(app).get(`/api/v1/tours/${tourId}`).set(bearer(a.traveler.token))).status).toBe(404);
    expect((await request(app).get(`/api/v1/tours/${tourId}`).set(bearer(a.agency.token))).status).toBe(200);

    // Cannot be submitted without a departure.
    expect((await request(app).post(`/api/v1/agency/tours/${tourId}/submit`).set(bearer(a.agency.token))).status).toBeGreaterThanOrEqual(400);
    await setDepartures(a.agency.token, tourId, [{ date: inDays(20), capacity: 4, isOpen: true }]);
    expect((await request(app).post(`/api/v1/agency/tours/${tourId}/submit`).set(bearer(a.agency.token))).status).toBe(202);

    // PENDING_REVIEW is locked for content edits.
    const locked = await request(app).patch(`/api/v1/agency/tours/${tourId}`).set(bearer(a.agency.token)).send({ title: 'New title here' });
    expect(locked.status).toBe(409);
    expect(locked.body.error.code).toBe('TOUR_LOCKED');

    expect((await request(app).post(`/api/v1/moderation/tours/${tourId}/validate`).set(bearer(a.moderator.token)).send({ approve: true })).status).toBe(200);
    expect((await request(app).get(`/api/v1/tours/${tourId}`)).status).toBe(200);
    const search = await request(app).get('/api/v1/tours').query({ q: 'ha long' });
    expect(search.body.data.map((t: { id: string }) => t.id)).toContain(tourId);

    // Material edit of an APPROVED tour: back to review, gone from the public list.
    expect((await request(app).patch(`/api/v1/agency/tours/${tourId}`).set(bearer(a.agency.token)).send({ title: 'Ha Long Bay 3D2N' })).status).toBe(200);
    expect((await loadTour(tourId))!.status).toBe('PENDING_REVIEW');
    expect((await request(app).get(`/api/v1/tours/${tourId}`)).status).toBe(404);
  });

  it('list items are light cards: no description, itinerary, departures or internal fields; pages are capped', async () => {
    const a = await actors();
    await approvedTour(a);

    const list = await request(app).get('/api/v1/tours');
    expect(list.status).toBe(200);
    const keys = Object.keys(list.body.data[0]).sort();
    expect(keys).toEqual(
      ['agency', 'basePrice', 'categoryIds', 'coverImage', 'destination', 'durationDays', 'id', 'nextDepartureDate', 'ratingAvg', 'ratingCount', 'summary', 'title'].filter((k) => keys.includes(k)),
    );
    expect(keys).not.toEqual(expect.arrayContaining(['description']));
    expect(JSON.stringify(list.body)).not.toMatch(/itinerary|departures|statusReason|reviewedBy|agencyId/);

    expect((await request(app).get('/api/v1/tours?limit=100000')).status).toBe(400);
    expect((await request(app).get('/api/v1/tours?limit=100')).status).toBe(200);
    expect((await request(app).get('/api/v1/tours?page=0')).status).toBe(400);
  });

  it('only a moderator decides, rejection needs a reason, an invalid transition is refused and parallel decisions yield one winner', async () => {
    const a = await actors();
    const tourId = await draftTour(a.agency.token, a.categoryId);
    await setDepartures(a.agency.token, tourId, [{ date: inDays(20), capacity: 4, isOpen: true }]);
    const validate = (token: string, body: object) =>
      request(app).post(`/api/v1/moderation/tours/${tourId}/validate`).set(bearer(token)).send(body);

    // Not submitted yet: nothing to approve.
    expect((await validate(a.moderator.token, { approve: true })).status).toBe(409);

    await request(app).post(`/api/v1/agency/tours/${tourId}/submit`).set(bearer(a.agency.token));
    expect((await validate(a.agency.token, { approve: true })).status).toBe(403);
    expect((await validate(a.traveler.token, { approve: true })).status).toBe(403);
    expect((await request(app).post(`/api/v1/moderation/tours/${tourId}/validate`).send({ approve: true })).status).toBe(401);
    expect((await validate(a.moderator.token, { approve: false })).status).toBe(400); // reason required

    const results = await Promise.all([
      validate(a.moderator.token, { approve: true }),
      validate(a.moderator.token, { approve: false, reason: 'Photos are missing' }),
      validate(a.moderator.token, { approve: true }),
    ]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);
  });

  it('a suspended tour disappears from sale and can no longer be booked', async () => {
    const a = await actors();
    const { tourId, departureId } = await approvedTour(a);
    expect((await book(a.traveler.token, tourId, departureId)).status).toBe(201);

    expect((await request(app).post(`/api/v1/moderation/tours/${tourId}/suspend`).set(bearer(a.moderator.token)).send({})).status).toBe(400);
    expect((await request(app).post(`/api/v1/moderation/tours/${tourId}/suspend`).set(bearer(a.moderator.token)).send({ reason: 'Fraud report' })).status).toBe(200);
    expect((await request(app).get(`/api/v1/tours/${tourId}`)).status).toBe(404);
    expect((await book(a.traveler.token, tourId, departureId)).status).toBe(404);
  });

  it("agencies only reach their own tours (404) and cannot touch each other's inventory", async () => {
    const a = await actors();
    const rival = await createVerifiedAgency('rival@example.com');
    const tourId = await draftTour(a.agency.token, a.categoryId);

    for (const call of [
      request(app).get(`/api/v1/agency/tours/${tourId}`).set(bearer(rival.token)),
      request(app).patch(`/api/v1/agency/tours/${tourId}`).set(bearer(rival.token)).send({ title: 'Hijacked title' }),
      request(app).delete(`/api/v1/agency/tours/${tourId}`).set(bearer(rival.token)),
      request(app).post(`/api/v1/agency/tours/${tourId}/submit`).set(bearer(rival.token)),
      setDepartures(rival.token, tourId, [{ date: inDays(5), capacity: 99, isOpen: true }]),
    ]) {
      expect((await call).status).toBe(404);
    }
    expect((await request(app).get('/api/v1/agency/tours').set(bearer(rival.token))).body.data).toHaveLength(0);
    // Travelers have no agency permissions at all.
    expect((await request(app).get('/api/v1/agency/tours').set(bearer(a.traveler.token))).status).toBe(403);
  });

  it('availability edits respect sold seats: capacity floor, no moving or removing a sold departure', async () => {
    const a = await actors();
    const { tourId, departureId } = await approvedTour(a, 5);
    expect((await book(a.traveler.token, tourId, departureId, 3)).status).toBe(201);

    const edit = (departures: object[]) => setDepartures(a.agency.token, tourId, departures);
    const same = { id: departureId, date: (await loadTour(tourId))!.departures[0]!.date.toISOString(), isOpen: true };

    const tooSmall = await edit([{ ...same, capacity: 2 }]);
    expect(tooSmall.status).toBe(409);
    expect(tooSmall.body.error.code).toBe('CAPACITY_BELOW_BOOKED');

    expect((await edit([])).status).toBe(409); // removing a departure with sold seats
    expect((await edit([{ ...same, date: inDays(40), capacity: 5 }])).status).toBe(409); // moving it

    expect((await edit([{ ...same, capacity: 8 }])).status).toBe(200);
    const stored = (await loadTour(tourId))!.departures[0]!;
    expect(stored.capacity).toBe(8);
    expect(stored.remaining).toBe(5); // 8 - 3 sold
  });

  it('seat accounting stays exact when bookings and availability edits race', async () => {
    const a = await actors();
    const { tourId, departureId } = await approvedTour(a, 10);
    const buyers = await Promise.all(Array.from({ length: 8 }, (_, i) => createUser('TRAVELER', `b${i}@example.com`)));

    const storedDate = (await loadTour(tourId))!.departures[0]!.date.toISOString();
    const edits = Array.from({ length: 4 }, (_, i) =>
      setDepartures(a.agency.token, tourId, [{ id: departureId, date: storedDate, capacity: 12 + i, isOpen: true }]),
    );
    const results = await Promise.all([...buyers.map((b) => book(b.token, tourId, departureId, 1)), ...edits]);
    expect(results.every((r) => r.status < 500)).toBe(true);

    const tour = (await loadTour(tourId))!;
    const dep = tour.departures[0]!;
    const sold = (await prisma.booking.findMany({ where: { tourId } })).reduce((sum, b) => sum + b.participants, 0);
    expect(sold).toBe(buyers.length);
    // The invariant that matters: free seats = capacity - sold, whatever the interleaving was.
    expect(dep.remaining).toBe(dep.capacity - sold);
    expect(dep.remaining).toBeGreaterThanOrEqual(0);
  });

  it('delete archives a tour without sold seats and refuses one with sold seats', async () => {
    const a = await actors();
    const empty = await draftTour(a.agency.token, a.categoryId);
    expect((await request(app).delete(`/api/v1/agency/tours/${empty}`).set(bearer(a.agency.token))).status).toBe(204);
    expect((await loadTour(empty))!.status).toBe('ARCHIVED');

    const { tourId, departureId } = await approvedTour(a);
    await book(a.traveler.token, tourId, departureId, 1);
    const blocked = await request(app).delete(`/api/v1/agency/tours/${tourId}`).set(bearer(a.agency.token));
    expect(blocked.status).toBe(409);
    expect((await loadTour(tourId))!.status).toBe('APPROVED');
  });

  it('guide assignment: only an active guide, only that guide answers, only once', async () => {
    const a = await actors();
    const guide = await createUser('TOUR_GUIDE', 'guide@example.com');
    const otherGuide = await createUser('TOUR_GUIDE', 'other-guide@example.com');
    const tourId = await draftTour(a.agency.token, a.categoryId);
    const assign = (guideId: string | null) =>
      request(app).put(`/api/v1/agency/tours/${tourId}/guide`).set(bearer(a.agency.token)).send({ guideId, feePerBooking: 200_000 });

    expect((await assign(a.traveler.id)).status).toBeGreaterThanOrEqual(400); // not a guide
    expect((await assign(guide.id)).status).toBe(200);

    const answer = (token: string, accept: boolean) =>
      request(app).post(`/api/v1/guide/tours/${tourId}/verification`).set(bearer(token)).send({ accept });
    expect((await answer(otherGuide.token, true)).status).toBe(404);
    expect((await answer(a.traveler.token, true)).status).toBe(403);

    const results = await Promise.all([answer(guide.token, true), answer(guide.token, false)]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect((await loadTour(tourId))!.guideAssignment!.status).not.toBe('PENDING');

    const mine = await request(app).get('/api/v1/guide/tours').set(bearer(guide.token));
    expect(mine.body.data.map((t: { id: string }) => t.id)).toEqual([tourId]);
    expect((await request(app).get('/api/v1/guide/tours').set(bearer(otherGuide.token))).body.data).toHaveLength(0);
  });
});
