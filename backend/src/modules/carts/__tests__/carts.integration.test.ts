import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import { prisma } from '../../../config/database';
import { bearer, createApprovedTour, createUser, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';

// Real Express app + real PostgreSQL: the traveler's cart, its privacy and the live-availability read model.
const app = createApp();

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);

describe('carts (integration)', () => {
  async function setup() {
    const agency = await createUser('AGENCY', 'agency@example.com');
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    const other = await createUser('TRAVELER', 'other@example.com');
    const tour = await createApprovedTour(agency.id, { capacity: 10, price: 1_000_000 });
    return { agency, traveler, other, ...tour };
  }
  const add = (token: string, body: { tourId: string; departureId: string; participants: number }) =>
    request(app).post('/api/v1/cart/items').set(bearer(token)).send(body);

  it('adds a tour with live totals, is idempotent under parallel adds, and is private', async () => {
    const { traveler, other, tourId, departureId } = await setup();

    const results = await Promise.all(Array.from({ length: 6 }, () => add(traveler.token, { tourId, departureId, participants: 2 })));
    expect(results.every((r) => r.status < 300)).toBe(true);
    expect(await prisma.cartItem.count()).toBe(1);

    const mine = await request(app).get('/api/v1/cart').set(bearer(traveler.token));
    expect(mine.status).toBe(200);
    expect(mine.body.data.items).toHaveLength(1);
    expect(mine.body.data.items[0]).toMatchObject({ tourId, departureId, participants: 2, available: true, unitPrice: 1_000_000, subtotal: 2_000_000 });
    expect(mine.body.data.items[0].tour).toMatchObject({ id: tourId, title: 'Ha Long Bay 2D1N' });
    expect(mine.body.data.totals).toMatchObject({ itemCount: 1, participantCount: 2, availableCount: 1, unavailableCount: 0, subtotal: 2_000_000, currency: 'VND' });

    expect((await request(app).get('/api/v1/cart').set(bearer(other.token))).body.data.items).toHaveLength(0);
  });

  it('updates and removes only my own lines', async () => {
    const { traveler, other, tourId, departureId } = await setup();
    const added = await add(traveler.token, { tourId, departureId, participants: 2 });
    const itemId = added.body.data.id as string;

    expect((await request(app).patch(`/api/v1/cart/items/${itemId}`).set(bearer(other.token)).send({ participants: 5 })).status).toBe(404);
    expect((await request(app).delete(`/api/v1/cart/items/${itemId}`).set(bearer(other.token))).status).toBe(204);
    expect(await prisma.cartItem.count()).toBe(1);

    const updated = await request(app).patch(`/api/v1/cart/items/${itemId}`).set(bearer(traveler.token)).send({ participants: 3 });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ participants: 3, subtotal: 3_000_000 });

    expect((await request(app).delete(`/api/v1/cart/items/${itemId}`).set(bearer(traveler.token))).status).toBe(204);
    expect((await request(app).delete(`/api/v1/cart/items/${itemId}`).set(bearer(traveler.token))).status).toBe(204);
    expect(await prisma.cartItem.count()).toBe(0);
  });

  it('rejects unpublished tours, unknown departures and impossible head-counts', async () => {
    const { traveler, agency, tourId, departureId } = await setup();
    const draft = await prisma.tour.create({ data: { agencyId: agency.id, title: 'Draft tour', destination: 'Hue', durationDays: 1, basePrice: 1000, status: 'DRAFT' } });

    expect((await add(traveler.token, { tourId: draft.id, departureId, participants: 1 })).status).toBe(404);
    expect((await add(traveler.token, { tourId, departureId: '99999999-9999-4999-8999-999999999999', participants: 1 })).status).toBe(404);
    expect((await add(traveler.token, { tourId, departureId, participants: 11 })).status).toBe(409);
    expect((await add(traveler.token, { tourId, departureId, participants: 0 })).status).toBe(400);
    expect((await add(traveler.token, { tourId, departureId: 'nope', participants: 1 })).status).toBe(400);
  });

  it('reflects live availability changes: a closed departure or suspended tour is flagged, never hidden', async () => {
    const { traveler, tourId, departureId } = await setup();
    await add(traveler.token, { tourId, departureId, participants: 2 });

    await prisma.tourDeparture.updateMany({ where: { id: departureId }, data: { isOpen: false } });
    const closed = await request(app).get('/api/v1/cart').set(bearer(traveler.token));
    expect(closed.body.data.items[0]).toMatchObject({ available: false, unavailableReason: 'DEPARTURE_UNAVAILABLE' });
    expect(closed.body.data.totals).toMatchObject({ subtotal: 0, availableCount: 0, unavailableCount: 1 });

    // Editing the head-count of a stale line is a 409 with the reason, never a 404 ("not your line").
    const staleId = closed.body.data.items[0].id as string;
    const stalePatch = await request(app).patch(`/api/v1/cart/items/${staleId}`).set(bearer(traveler.token)).send({ participants: 1 });
    expect(stalePatch.status).toBe(409);
    expect(stalePatch.body.error.code).toBe('DEPARTURE_UNAVAILABLE');

    await prisma.tourDeparture.updateMany({ where: { id: departureId }, data: { isOpen: true } });
    await prisma.tour.updateMany({ where: { id: tourId }, data: { status: 'SUSPENDED' } });
    const suspended = await request(app).get('/api/v1/cart').set(bearer(traveler.token));
    expect(suspended.body.data.items[0]).toMatchObject({ available: false, unavailableReason: 'TOUR_UNAVAILABLE' });
    expect((await request(app).patch(`/api/v1/cart/items/${staleId}`).set(bearer(traveler.token)).send({ participants: 1 })).status).toBe(409);

    // ...and it can still be removed.
    const itemId = suspended.body.data.items[0].id as string;
    expect((await request(app).delete(`/api/v1/cart/items/${itemId}`).set(bearer(traveler.token))).status).toBe(204);
    expect(await prisma.cartItem.count()).toBe(0);
  });

  it('needs the traveler permission', async () => {
    const { agency, tourId, departureId } = await setup();
    expect((await add(agency.token, { tourId, departureId, participants: 1 })).status).toBe(403);
    expect((await request(app).get('/api/v1/cart')).status).toBe(401);
  });
});
