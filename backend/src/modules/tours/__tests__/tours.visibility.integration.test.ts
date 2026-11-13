import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app';
import { prisma } from '../../../config/database';
import {
  bearer,
  createApprovedTour,
  createUser,
  createVerifiedAgency,
  resetDatabase,
  startDatabase,
  stopDatabase,
} from '../../../test/integration';
import { toursDiscoveryService } from '../tours-discovery.service';

// Real Express app + real PostgreSQL: a PRIVATE tour must stay invisible and unbookable on every public path, even
// when it is APPROVED, while its owner agency keeps full access.
const app = createApp();

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(async () => {
  await resetDatabase();
  // The discovery caches are process-wide; a reset database must never be read through a warmed cache.
  toursDiscoveryService.invalidateCache();
});
afterEach(() => vi.restoreAllMocks());

const contact = { fullName: 'Nguyen Van A', phone: '0901234567' };
const ids = (res: { body: { data: { id: string }[] } }) => res.body.data.map((tour) => tour.id);

/** One APPROVED PRIVATE tour (Quang Ninh) plus one APPROVED PUBLIC tour (Ha Noi) of the same agency. */
async function setup() {
  const agency = await createVerifiedAgency('agency@example.com');
  const traveler = await createUser('TRAVELER', 'traveler@example.com');
  const other = await createUser('TRAVELER', 'other@example.com');
  const privateTour = await createApprovedTour(agency.id, { capacity: 6 });
  await prisma.tour.update({ where: { id: privateTour.tourId }, data: { visibility: 'PRIVATE' } });
  const publicTour = await createApprovedTour(agency.id, { capacity: 6 });
  await prisma.tour.update({
    where: { id: publicTour.tourId },
    data: { title: 'Ha Noi City Tour', destination: 'Ha Noi' },
  });
  return { agency, traveler, other, privateTour, publicTour };
}

describe('private tour visibility (integration)', () => {
  it('keeps an APPROVED PRIVATE tour out of search, list, destinations, cards and public detail', async () => {
    const { agency, other, privateTour, publicTour } = await setup();

    expect(ids(await request(app).get('/api/v1/tours').query({ q: 'ha long' }))).toEqual([]);

    const list = await request(app).get('/api/v1/tours');
    expect(ids(list)).toContain(publicTour.tourId);
    expect(ids(list)).not.toContain(privateTour.tourId);

    const destinations = await request(app).get('/api/v1/tours/destinations');
    expect(destinations.body.data.map((destination: { destination: string }) => destination.destination)).toEqual(['Ha Noi']);

    const cards = await toursDiscoveryService.getPublicCards([privateTour.tourId, publicTour.tourId]);
    expect([...cards.keys()]).toEqual([publicTour.tourId]);

    // Knowing the id is not enough: a guest and another traveler get 404…
    expect((await request(app).get(`/api/v1/tours/${privateTour.tourId}`)).status).toBe(404);
    expect((await request(app).get(`/api/v1/tours/${privateTour.tourId}`).set(bearer(other.token))).status).toBe(404);
    // …but the owning agency still reads its own tour through the manage endpoint.
    const manage = await request(app).get(`/api/v1/agency/tours/${privateTour.tourId}`).set(bearer(agency.token));
    expect(manage.status).toBe(200);
    expect(manage.body.data).toMatchObject({ id: privateTour.tourId, status: 'APPROVED', visibility: 'PRIVATE' });
  });

  it('refuses to save it to a wishlist and flags a stale cart line as unavailable', async () => {
    const { traveler, privateTour } = await setup();

    expect((await request(app).post(`/api/v1/wishlist/${privateTour.tourId}`).set(bearer(traveler.token))).status).toBe(404);
    expect(await prisma.wishlistItem.count()).toBe(0);

    await prisma.cartItem.create({
      data: { userId: traveler.id, tourId: privateTour.tourId, departureId: privateTour.departureId, participants: 2 },
    });
    const cart = await request(app).get('/api/v1/cart').set(bearer(traveler.token));
    expect(cart.body.data.items[0]).toMatchObject({ available: false, unavailableReason: 'TOUR_UNAVAILABLE' });
    expect(cart.body.data.items[0].tour).toBeUndefined();
  });

  it('answers 404 for a direct booking and a direct cart add, leaving inventory untouched', async () => {
    const { traveler, privateTour } = await setup();
    const body = { tourId: privateTour.tourId, departureId: privateTour.departureId, participants: 2, contact };

    const booking = await request(app).post('/api/v1/bookings').set(bearer(traveler.token)).send(body);
    expect(booking.status).toBe(404);
    expect(booking.body.error.code).toBe('NOT_FOUND');
    expect(await prisma.booking.count()).toBe(0);

    const cart = await request(app)
      .post('/api/v1/cart/items')
      .set(bearer(traveler.token))
      .send({ tourId: privateTour.tourId, departureId: privateTour.departureId, participants: 2 });
    expect(cart.status).toBe(404);
    expect(cart.body.error.code).toBe('NOT_FOUND');
    expect(await prisma.cartItem.count()).toBe(0);

    const departure = await prisma.tourDeparture.findUniqueOrThrow({ where: { id: privateTour.departureId } });
    expect(departure.remaining).toBe(6);
  });

  it('drops a tour from a warmed search cache once visibility changes and discovery invalidation runs', async () => {
    const agency = await createVerifiedAgency('agency@example.com');
    const { tourId } = await createApprovedTour(agency.id);
    const search = () => request(app).get('/api/v1/tours').query({ q: 'ha long' });

    expect(ids(await search())).toContain(tourId); // cache is now warm
    await prisma.tour.update({ where: { id: tourId }, data: { visibility: 'PRIVATE' } });
    // The stale entry would still be served (that is what makes the assertion below meaningful)…
    expect(ids(await search())).toContain(tourId);
    toursDiscoveryService.invalidateCache(tourId);
    // …and after invalidation the next search reads the database and hides the now-private tour.
    expect(ids(await search())).not.toContain(tourId);
  });

  it('clears discovery caches when the agency accepts a custom-tour request (S3 clone path)', async () => {
    const agency = await createVerifiedAgency('agency@example.com');
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    const { tourId } = await createApprovedTour(agency.id);
    const created = await request(app)
      .post('/api/v1/custom-tours')
      .set(bearer(traveler.token))
      .send({ sourceTourId: tourId, participants: 3 });
    expect(created.status).toBe(201);

    const invalidate = vi.spyOn(toursDiscoveryService, 'invalidateCache');
    const accepted = await request(app)
      .patch(`/api/v1/custom-tours/${created.body.data.id}/decision`)
      .set(bearer(agency.token))
      .send({ decision: 'ACCEPT' });
    expect(accepted.status).toBe(200);
    expect(invalidate).toHaveBeenCalledWith(expect.any(String));
  });
});
