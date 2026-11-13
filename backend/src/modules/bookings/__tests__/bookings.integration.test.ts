import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import { bearer, createApprovedTour, createUser, resetDatabase, startDatabase, stopDatabase, loadTour } from '../../../test/integration';
import { prisma } from '../../../config/database';

// Real Express app + real PostgreSQL: seat accounting, idempotent creation and ownership under concurrency.
const app = createApp();

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);

const contact = { fullName: 'Nguyen Van A', phone: '0901234567' };
const book = (token: string, tourId: string, departureId: string, participants = 1, extra: object = {}) =>
  request(app).post('/api/v1/bookings').set(bearer(token)).send({ tourId, departureId, participants, contact, ...extra });

const remainingOf = async (tourId: string) => (await loadTour(tourId))!.departures[0]!.remaining;

async function setup(capacity = 10) {
  const agency = await createUser('AGENCY', 'agency@example.com');
  const traveler = await createUser('TRAVELER', 'traveler@example.com');
  const tour = await createApprovedTour(agency.id, { capacity });
  return { agency, traveler, ...tour };
}

describe('bookings (integration)', () => {
  it('stores passenger details and exports the selected departure for agency STAFF', async () => {
    const { agency, traveler, tourId, departureId } = await setup();
    const staff = await createUser('TRAVELER', 'staff@example.com');
    await prisma.agencyMember.create({ data: { agencyId: agency.id, userId: staff.id, role: 'STAFF' } });
    const created = await book(traveler.token, tourId, departureId, 2, { passengers: [
      { fullName: 'Nguyen Lan', birthYear: 1990, ageGroup: 'ADULT', pickupPoint: 'Gate A', phone: '0901234567' },
      { fullName: 'Tran An', ageGroup: 'CHILD', specialNotes: 'Allergy' },
    ] });
    expect(created.status).toBe(201);
    const bookingId = created.body.data.id as string;
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).passengers).toHaveLength(2);
    await prisma.booking.update({ where: { id: bookingId }, data: { status: 'CONFIRMED', isPaid: true } });
    const url = `/api/v1/agency/tours/${tourId}/departures/${departureId}/customers.pdf`;
    const result = await request(app).get(url).set(bearer(staff.token)).set('X-Agency-Id', agency.id);
    expect(result.status).toBe(200);
    expect(result.headers['content-type']).toContain('application/pdf');
    const otherAgency = await createUser('AGENCY', 'other-agency@example.com');
    expect((await request(app).get(url).set(bearer(otherAgency.token))).status).toBe(404);
    expect((await request(app).get(`/api/v1/agency/tours/${tourId}/departures/11111111-1111-4111-8111-111111111111/customers.pdf`).set(bearer(staff.token)).set('X-Agency-Id', agency.id)).status).toBe(404);
  });

  it('creates a PENDING booking with server-side money and reserves the seats', async () => {
    const { traveler, tourId, departureId } = await setup(10);

    const res = await book(traveler.token, tourId, departureId, 3);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ status: 'PENDING', participants: 3, unitPrice: 1_000_000, subtotal: 3_000_000 });
    expect(await remainingOf(tourId)).toBe(7);

    const stored = await prisma.booking.findUnique({ where: { id: res.body.data.id } });
    expect(stored!.commissionAmount + stored!.agencyAmount).toBe(stored!.totalAmount);
  });

  it('never oversells: parallel bookings beyond capacity get 409 and the counter stays consistent', async () => {
    const { tourId, departureId } = await setup(3);
    const travelers = await Promise.all(Array.from({ length: 8 }, (_, i) => createUser('TRAVELER', `capacity-${i}@example.com`)));

    const results = await Promise.all(
      travelers.map((traveler, i) => book(traveler.token, tourId, departureId, 1, { clientRequestId: `req-${i}-abcdefgh` })),
    );
    const created = results.filter((r) => r.status === 201);
    expect(created).toHaveLength(3);
    // Once the last seat is gone the departure counts as sold out, before that it is 'not enough seats'.
    expect(results.filter((r) => r.status === 409).every((r) => ['NOT_ENOUGH_SEATS', 'DEPARTURE_UNAVAILABLE'].includes(r.body.error.code))).toBe(true);
    expect(await remainingOf(tourId)).toBe(0);
    expect(await prisma.booking.count()).toBe(3);
  });

  it('blocks another PENDING booking for the same departure, allows a different date, and allows booking after cancellation', async () => {
    const { traveler, tourId, departureId } = await setup(24);
    const first = await book(traveler.token, tourId, departureId, 4);
    expect(first.status).toBe(201);
    expect(await remainingOf(tourId)).toBe(20);
    const blocked = await book(traveler.token, tourId, departureId, 10, { clientRequestId: 'new-key-same-departure' });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toMatchObject({ code: 'PENDING_BOOKING_EXISTS', details: { bookingId: first.body.data.id } });
    expect(await remainingOf(tourId)).toBe(20);

    const otherDate = await prisma.tourDeparture.create({ data: { tourId, date: new Date(Date.now() + 60 * 86400000), capacity: 24, remaining: 24, isOpen: true } });
    expect((await book(traveler.token, tourId, otherDate.id, 10)).status).toBe(201);
    expect((await prisma.tourDeparture.findUnique({ where: { id: otherDate.id } }))!.remaining).toBe(14);

    expect((await request(app).post(`/api/v1/bookings/${first.body.data.id}/cancel`).set(bearer(traveler.token)).send({})).status).toBe(200);
    expect((await book(traveler.token, tourId, departureId, 10)).status).toBe(201);
    expect((await prisma.tourDeparture.findUnique({ where: { id: departureId } }))!.remaining).toBe(14);
  });

  it.each([false, true])('creates one pending booking for concurrent distinct requests (voucher=%s)', async withVoucher => {
    const { agency, traveler, tourId, departureId } = await setup(24);
    if (withVoucher) {
      const promotion = await request(app).post('/api/v1/agency/promotions').set(bearer(agency.token)).send({
        code: 'PENDING10', title: 'QA Pending Discount', discountType: 'FIXED', discountValue: 100000,
        startsAt: new Date(Date.now() - 86400000).toISOString(), endsAt: new Date(Date.now() + 86400000).toISOString(), usageLimit: 10,
      });
      expect(promotion.status).toBe(201);
    }
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => book(traveler.token, tourId, departureId, 2, {
      clientRequestId: `distinct-pending-key-${i}`, ...(withVoucher ? { agencyPromotionCode: 'PENDING10' } : {}),
    })));
    expect(results.filter(result => result.status === 201)).toHaveLength(1);
    expect(results.filter(result => result.status === 409 && result.body.error.code === 'PENDING_BOOKING_EXISTS')).toHaveLength(5);
    expect(await prisma.booking.count()).toBe(1);
    expect(await remainingOf(tourId)).toBe(22);
    if (withVoucher) expect((await prisma.promotion.findFirst({ where: { code: 'PENDING10' } }))!.usedCount).toBe(1);
  });

  it('the same clientRequestId creates one booking and reserves seats once, even when sent in parallel', async () => {
    const { traveler, tourId, departureId } = await setup(10);

    const results = await Promise.all(
      Array.from({ length: 6 }, () => book(traveler.token, tourId, departureId, 2, { clientRequestId: 'same-key-12345' })),
    );
    expect(results.map((r) => r.status + JSON.stringify(r.body).slice(0, 160))).toEqual(results.map(() => expect.stringMatching(/^201/)));
    expect(new Set(results.map((r) => r.body.data.id)).size).toBe(1);
    expect(await prisma.booking.count()).toBe(1);
    expect(await remainingOf(tourId)).toBe(8);
  });

  it('cancelling releases the seats exactly once, even when cancelled twice in parallel', async () => {
    const { traveler, tourId, departureId } = await setup(10);
    const created = await book(traveler.token, tourId, departureId, 4);
    expect(await remainingOf(tourId)).toBe(6);

    const cancels = await Promise.all(
      [1, 2, 3].map(() => request(app).post(`/api/v1/bookings/${created.body.data.id}/cancel`).set(bearer(traveler.token)).send({})),
    );
    expect(cancels.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await remainingOf(tourId)).toBe(10);
    expect((await prisma.booking.findUnique({ where: { id: created.body.data.id } }))!.status).toBe('CANCELLED');
  });

  it("hides other travelers' bookings (404) and rejects roles without the permission", async () => {
    const { traveler, agency, tourId, departureId } = await setup(10);
    const stranger = await createUser('TRAVELER', 'stranger@example.com');
    const created = await book(traveler.token, tourId, departureId, 1);
    const id = created.body.data.id;

    expect((await request(app).get(`/api/v1/bookings/${id}`).set(bearer(stranger.token))).status).toBe(404);
    expect((await request(app).post(`/api/v1/bookings/${id}/cancel`).set(bearer(stranger.token)).send({})).status).toBe(404);
    expect((await request(app).get(`/api/v1/bookings/${id}`).set(bearer(traveler.token))).status).toBe(200);

    // The agency that owns the tour sees it in its own list, the stranger's list stays empty.
    const agencyList = await request(app).get('/api/v1/agency/bookings').set(bearer(agency.token));
    expect(agencyList.status).toBe(200);
    expect(agencyList.body.data).toHaveLength(1);
    expect((await request(app).get('/api/v1/bookings/me').set(bearer(stranger.token))).body.data).toHaveLength(0);

    // An agency cannot book, a guest cannot book.
    expect((await book(agency.token, tourId, departureId)).status).toBe(403);
    expect((await request(app).post('/api/v1/bookings').send({ tourId, departureId, participants: 1, contact })).status).toBe(401);
  });

  it('ignores client-supplied prices and unknown fields', async () => {
    const { traveler, tourId, departureId } = await setup(10);
    const res = await book(traveler.token, tourId, departureId, 1, { unitPrice: 1, totalAmount: 1, status: 'CONFIRMED' });
    expect(res.status).toBe(400);
  });
});
