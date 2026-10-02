import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { prisma } from '../../config/database';
import {
  bearer,
  createApprovedTour,
  createCategory,
  createUser,
  findInefficientQueries,
  loadTour,
  startDatabase,
  startQueryRecording,
  stopDatabase,
} from '../../test/integration';

// Real Express app + real PostgreSQL: the hot, unbounded list queries must be answered from an index
// (no sequential scan, no blocking in-memory sort). PostgreSQL's own planner is asked via EXPLAIN with
// sequential scans and explicit sorts disabled, so anything that still shows up has no usable index.
const app = createApp();

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);

const get = (url: string, token?: string) => (token ? request(app).get(url).set(bearer(token)) : request(app).get(url));
const contact = { fullName: 'Nguyen Van A', phone: '0901234567' };

// Tables whose lists grow without bound; owner-scoped small lists and staff queues are allowed to sort in memory.
const HOT = ['Tour', 'Booking', 'Notification', 'Review', 'Report', 'ETicket', 'Conversation', 'Message', 'WishlistItem', 'Earning'];
const touchesHotTable = (sql: string) => HOT.some((table) => sql.includes(`"public"."${table}"`));

describe('query plans (integration)', () => {
  it('public discovery, my bookings, agency bookings, notifications, reviews and idempotency lookups are index-backed', async () => {
    const agency = await createUser('AGENCY', 'agency@example.com');
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    const categoryId = await createCategory();
    for (let i = 0; i < 12; i += 1) await createApprovedTour(agency.id, { price: 500_000 + i * 10_000 });
    const first = await loadTour((await prisma.tour.findFirst())!.id);
    for (const tour of await prisma.tour.findMany()) {
      await prisma.tour.update({ where: { id: tour.id }, data: { categories: { connect: [{ id: categoryId }] } } });
    }

    await startQueryRecording();

    // Public discovery, every sort and the main filters.
    for (const sort of ['newest', 'price_asc', 'price_desc', 'rating']) {
      expect((await get(`/api/v1/tours?sort=${sort}`)).status).toBe(200);
    }
    expect((await get(`/api/v1/tours?categoryId=${categoryId}&sort=newest`)).status).toBe(200);
    expect((await get('/api/v1/tours?minPrice=500000&maxPrice=900000&sort=price_asc')).status).toBe(200);
    expect((await get(`/api/v1/tours/${first!.id}`)).status).toBe(200);

    // Booking creation (idempotency lookup), traveler and agency lists.
    const departureId = first!.departures[0]!.id;
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
    expect(await prisma.booking.count()).toBe(1);

    // Control: the audit must really notice a statement no index can serve (filter on an unindexed column).
    await prisma.booking.findMany({ where: { notes: 'no index on this column' } });

    const all = await findInefficientQueries();
    expect(all.some((o) => o.scans.includes('Booking') && o.sql.includes('"notes"')), 'the control query must be flagged').toBe(true);
    const offenders = all.filter((o) => !o.sql.includes('"notes"') && touchesHotTable(o.sql) && (o.sorts || o.scans.some((t) => HOT.includes(t))));
    expect(offenders, JSON.stringify(offenders, null, 1)).toEqual([]);
  });
});
