import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { TourModel } from '../../modules/tours/tours.model';
import { BookingModel } from '../../modules/bookings/bookings.model';
import {
  bearer,
  createApprovedTour,
  createCategory,
  createUser,
  findInefficientQueries,
  startDatabase,
  startQueryRecording,
  stopDatabase,
} from '../../test/integration';

// Real Express app + real MongoDB: the hot, unbounded list queries must be answered from an index
// (no COLLSCAN, no blocking in-memory SORT). MongoDB's own query planner is asked via explain().
const app = createApp();

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);

const get = (url: string, token?: string) => (token ? request(app).get(url).set(bearer(token)) : request(app).get(url));
const contact = { fullName: 'Nguyen Van A', phone: '0901234567' };

// Collections whose lists grow without bound; owner-scoped small lists and staff queues are allowed to sort in memory.
const HOT = new Set(['tours', 'bookings', 'notifications', 'reviews', 'reports', 'etickets', 'conversations', 'messages', 'wishlistitems', 'earnings']);

describe('query plans (integration)', () => {
  it('public discovery, my bookings, agency bookings, notifications, reviews and idempotency lookups are index-backed', async () => {
    const agency = await createUser('AGENCY', 'agency@example.com');
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    const categoryId = await createCategory();
    for (let i = 0; i < 12; i += 1) await createApprovedTour(agency.id, { price: 500_000 + i * 10_000 });
    const first = await TourModel.findOne();
    await TourModel.updateMany({}, { $set: { categoryIds: [categoryId] } });

    startQueryRecording();

    // Public discovery, every sort and the main filters.
    for (const sort of ['newest', 'price_asc', 'price_desc', 'rating']) {
      expect((await get(`/api/v1/tours?sort=${sort}`)).status).toBe(200);
    }
    expect((await get(`/api/v1/tours?categoryId=${categoryId}&sort=newest`)).status).toBe(200);
    expect((await get('/api/v1/tours?minPrice=500000&maxPrice=900000&sort=price_asc')).status).toBe(200);
    expect((await get(`/api/v1/tours/${first!.id}`)).status).toBe(200);

    // Booking creation (idempotency lookup), traveler and agency lists.
    const departureId = String(first!.departures[0]!._id);
    const key = { clientRequestId: 'plan-check-0001' };
    for (let i = 0; i < 2; i += 1) {
      const res = await request(app)
        .post('/api/v1/bookings')
        .set(bearer(traveler.token))
        .send({ tourId: first!.id, departureId, participants: 1, contact, ...key });
      expect(res.status).toBe(201);
    }
    expect((await get('/api/v1/bookings/me', traveler.token)).status).toBe(200);
    expect((await get('/api/v1/bookings/me?status=PENDING', traveler.token)).status).toBe(200);
    expect((await get('/api/v1/agency/bookings', agency.token)).status).toBe(200);
    expect((await get('/api/v1/agency/bookings?status=PENDING', agency.token)).status).toBe(200);
    expect((await get('/api/v1/notifications', traveler.token)).status).toBe(200);
    expect((await get('/api/v1/notifications/unread-count', traveler.token)).status).toBe(200);
    expect((await get(`/api/v1/reviews?tourId=${first!.id}`)).status).toBe(200);
    expect((await get(`/api/v1/reviews?agencyId=${agency.id}`)).status).toBe(200);
    expect((await get('/api/v1/e-tickets', traveler.token)).status).toBe(200);
    expect((await get('/api/v1/reports/me', traveler.token)).status).toBe(200);
    expect(await BookingModel.countDocuments()).toBe(1);

    const offenders = (await findInefficientQueries()).filter((o) => HOT.has(o.collection));
    expect(offenders, JSON.stringify(offenders, null, 1)).toEqual([]);
  });
});
