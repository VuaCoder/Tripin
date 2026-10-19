import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../../integrations/cloudinary', async importOriginal => ({
  ...await importOriginal<typeof import('../../../integrations/cloudinary')>(),
  verifyImageUpload: vi.fn(async (_purpose, _owner, publicId) => ({ publicId, secureUrl: 'https://res.cloudinary.com/test/image/upload/trip.jpg' })),
}));
import { createApp } from '../../../app';
import { bookingsService } from '../../bookings';
import { bearer, createApprovedTour, createUser, resetDatabase, startDatabase, stopDatabase, loadTour } from '../../../test/integration';
import { prisma } from '../../../config/database';

// Real Express app + real PostgreSQL: reviews, rating statistics and guide earnings after a trip is completed.
const app = createApp();

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);

const contact = { fullName: 'Nguyen Van A', phone: '0901234567' };
const review = (token: string, bookingId: string, rating = 5, comment = 'A wonderful trip, thank you!') =>
  request(app).post('/api/v1/reviews').set(bearer(token)).send({ bookingId, rating, comment });

async function bookTrip(traveler: { token: string }, tourId: string, departureId: string) {
  const res = await request(app).post('/api/v1/bookings').set(bearer(traveler.token)).send({ tourId, departureId, participants: 1, contact });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

/** Pretends the traveler paid and the trip is over, then lets the real completion job run. */
async function completeTrips(bookingIds: string[]) {
  await prisma.booking.updateMany({ where: { id: { in: bookingIds } }, data: { status: 'CONFIRMED', isPaid: true, confirmedAt: new Date(), endDate: new Date(Date.now() - 3_600_000), paymentExpiresAt: null } });
  return bookingsService.completeFinishedBookings();
}

async function setup() {
  const agency = await createUser('AGENCY', 'agency@example.com');
  const tour = await createApprovedTour(agency.id, { capacity: 20 });
  const traveler = await createUser('TRAVELER', 'traveler@example.com', { fullName: 'Tran Thi B' });
  const moderator = await createUser('MODERATOR', 'mod@example.com');
  return { agency, traveler, moderator, ...tour };
}

describe('reviews (integration)', () => {
  it('lets guests read profiles and visible reviews scoped to the guide who led the completed booking', async () => {
    const { agency, traveler, moderator, tourId, departureId } = await setup();
    const guide = await createUser('TOUR_GUIDE', 'public-guide@example.com');
    const otherGuide = await createUser('TOUR_GUIDE', 'other-guide@example.com');
    const bookingId = await bookTrip(traveler, tourId, departureId);
    await completeTrips([bookingId]);
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    await prisma.earning.create({ data: { guideId: guide.id, bookingId, bookingCode: booking.bookingCode, tourId, tourTitle: booking.tourTitle, agencyId: agency.id, amount: 0, earnedAt: new Date() } });
    // Changing the current tour guide must not move an old trip's reviews to that new guide.
    await prisma.tourGuideAssignment.upsert({ where: { tourId }, create: { tourId, guideId: otherGuide.id, feePerBooking: 0, status: 'ACCEPTED' }, update: { guideId: otherGuide.id, status: 'ACCEPTED' } });
    const created = await review(traveler.token, bookingId, 4);
    expect(created.status).toBe(201);
    for (const path of [`agencies/${agency.id}`, `tour-guides/${guide.id}`]) {
      const profile = await request(app).get(`/api/v1/${path}`);
      expect(profile.status).toBe(200);
      expect(profile.body.data).not.toHaveProperty('email');
      expect(profile.body.data).not.toHaveProperty('phone');
    }
    for (const filter of [{ agencyId: agency.id }, { guideId: guide.id }]) {
      const result = await request(app).get('/api/v1/reviews').query({ ...filter, sort: 'rating_desc', limit: 1 });
      expect(result.status).toBe(200);
      expect(result.body.data).toHaveLength(1);
      expect(result.body.meta.total).toBe(1);
      expect(result.body.data[0]).not.toHaveProperty('travelerId');
      expect(result.body.data[0].author.name).not.toBe('Tran Thi B');
    }
    expect((await request(app).get('/api/v1/reviews').query({ guideId: otherGuide.id })).body.data).toEqual([]);
    for (const sort of ['newest', 'rating_asc']) {
      const result = await request(app).get('/api/v1/reviews').query({ guideId: guide.id, sort });
      expect(result.status).toBe(200);
      expect(result.body.data[0].id).toBe(created.body.data.id);
    }
    expect((await request(app).get('/api/v1/reviews').query({ guideId: guide.id, page: 2, limit: 1 })).body.data).toEqual([]);
    expect((await request(app).get('/api/v1/reviews').query({ guideId: guide.id, tourId })).status).toBe(400);
    expect((await request(app).get('/api/v1/reviews').query({ guideId: 'invalid' })).status).toBe(400);
    expect((await request(app).post('/api/v1/bookings').send({})).status).toBe(401);
    await request(app).post(`/api/v1/moderation/reviews/${created.body.data.id}/moderate`).set(bearer(moderator.token)).send({ hide: true, reason: 'Hidden for test' }).expect(200);
    const hidden = await request(app).get('/api/v1/reviews').query({ guideId: guide.id });
    expect(hidden.body.data).toEqual([]);
    expect(hidden.body.meta.total).toBe(0);
  });
  it('persists verified photos, returns them publicly, hides them with moderation and rejects foreign assets', async () => {
    const { traveler, moderator, tourId, departureId } = await setup();
    const bookingId = await bookTrip(traveler, tourId, departureId);
    await completeTrips([bookingId]);
    const endpoint = '/api/v1/reviews';
    const base = { bookingId, rating: 5, comment: 'A wonderful trip with beautiful views!' };
    const foreign = await request(app).post(endpoint).set(bearer(traveler.token)).send({ ...base, imagePublicIds: ['tripin/reviews/foreign/asset'] });
    expect(foreign.status).toBe(403);
    const tooMany = await request(app).post(endpoint).set(bearer(traveler.token)).send({ ...base, imagePublicIds: Array.from({ length: 7 }, (_, index) => String(index)) });
    expect(tooMany.status).toBe(400);
    const imagePublicIds = [`tripin/reviews/${traveler.id}/${bookingId}/11111111-1111-4111-8111-111111111111`];
    const created = await request(app).post(endpoint).set(bearer(traveler.token)).send({ ...base, imagePublicIds });
    expect(created.status).toBe(201);
    expect(created.body.data.images).toEqual(['https://res.cloudinary.com/test/image/upload/trip.jpg']);
    expect((await prisma.review.findUniqueOrThrow({ where: { bookingId } })).images).toEqual(created.body.data.images);
    const publicList = await request(app).get(endpoint).query({ tourId });
    expect(publicList.body.data[0].images).toEqual(created.body.data.images);
    await prisma.review.update({ where: { bookingId }, data: { status: 'HIDDEN', moderatedById: moderator.id } });
    expect((await request(app).get(endpoint).query({ tourId })).body.data).toHaveLength(0);
    const signature = await request(app).post('/api/v1/reviews/images/upload-signature').set(bearer(traveler.token)).send({ bookingId });
    expect(signature.status).toBe(409);
  });

  it('only the owner of a COMPLETED booking can review it, once, even when the request is sent in parallel', async () => {
    const { traveler, tourId, departureId } = await setup();
    const stranger = await createUser('TRAVELER', 'stranger@example.com');
    const bookingId = await bookTrip(traveler, tourId, departureId);

    const early = await review(traveler.token, bookingId);
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe('BOOKING_NOT_COMPLETED');

    await completeTrips([bookingId]);
    expect((await review(stranger.token, bookingId)).status).toBe(404);
    expect((await review(traveler.token, bookingId, 6)).status).toBe(400);
    expect((await review(traveler.token, bookingId, 5, 'short')).status).toBe(400);

    const results = await Promise.all(Array.from({ length: 5 }, () => review(traveler.token, bookingId, 4)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409).every((r) => r.body.error.code === 'REVIEW_EXISTS')).toBe(true);

    const mine = await request(app).get('/api/v1/reviews/me').set(bearer(traveler.token));
    expect(mine.body.data).toHaveLength(1);
    expect((await request(app).get('/api/v1/reviews/me').set(bearer(stranger.token))).body.data).toHaveLength(0);
  });

  it('public reviews mask the author and a hidden review leaves the list and the rating until restored', async () => {
    const { traveler, moderator, tourId, departureId } = await setup();
    const bookingId = await bookTrip(traveler, tourId, departureId);
    await completeTrips([bookingId]);
    const created = await review(traveler.token, bookingId, 4);
    const reviewId = created.body.data.id;

    expect((await request(app).get('/api/v1/reviews')).status).toBe(400); // tourId or agencyId required
    const publicList = await request(app).get('/api/v1/reviews').query({ tourId });
    expect(publicList.body.data).toHaveLength(1);
    expect(JSON.stringify(publicList.body.data)).not.toContain('traveler@example.com');
    expect(JSON.stringify(publicList.body.data)).not.toContain('Tran Thi B'); // masked, not the full name
    expect((await loadTour(tourId))!.ratingCount).toBe(1);

    const moderate = (body: object, token = moderator.token) =>
      request(app).post(`/api/v1/moderation/reviews/${reviewId}/moderate`).set(bearer(token)).send(body);
    expect((await moderate({ hide: true }, traveler.token)).status).toBe(403);
    expect((await moderate({ hide: true })).status).toBe(400); // reason required
    const hides = await Promise.all([moderate({ hide: true, reason: 'Offensive' }), moderate({ hide: true, reason: 'Offensive' })]);
    expect(hides.filter((r) => r.status === 200)).toHaveLength(1);

    expect((await request(app).get('/api/v1/reviews').query({ tourId })).body.data).toHaveLength(0);
    expect(await loadTour(tourId).then((t) => [t!.ratingCount, t!.ratingAvg])).toEqual([0, 0]);
    // The author still sees (and is told about) the hidden review.
    expect((await request(app).get('/api/v1/reviews/me').set(bearer(traveler.token))).body.data).toHaveLength(1);

    expect((await moderate({ hide: false })).status).toBe(200);
    expect(await loadTour(tourId).then((t) => [t!.ratingCount, t!.ratingAvg])).toEqual([1, 4]);
  });

  it('the tour rating stays exact when many travelers review at the same moment', async () => {
    const { tourId, departureId } = await setup();
    const travelers = await Promise.all(Array.from({ length: 8 }, (_, i) => createUser('TRAVELER', `t${i}@example.com`)));
    const bookingIds = await Promise.all(travelers.map((t) => bookTrip(t, tourId, departureId)));
    await completeTrips(bookingIds);

    const ratings = [5, 4, 3, 5, 4, 2, 1, 5];
    const results = await Promise.all(travelers.map((t, i) => review(t.token, bookingIds[i]!, ratings[i])));
    expect(results.every((r) => r.status === 201)).toBe(true);

    const tour = (await loadTour(tourId))!;
    expect(tour.ratingCount).toBe(8);
    expect(tour.ratingAvg).toBeCloseTo(ratings.reduce((a, b) => a + b, 0) / 8, 2);
  });
});

describe('earnings (integration)', () => {
  async function guideSetup(guideStatus: 'ACCEPTED' | 'PENDING' | undefined) {
    const base = await setup();
    const guide = await createUser('TOUR_GUIDE', 'guide@example.com');
    if (guideStatus) {
      await prisma.tourGuideAssignment.create({ data: { tourId: base.tourId, guideId: guide.id, feePerBooking: 250_000, status: guideStatus } });
    }
    return { ...base, guide };
  }

  it('completing a booking pays the accepted guide exactly once, however often or concurrently the job runs', async () => {
    const { traveler, guide, tourId, departureId } = await guideSetup('ACCEPTED');
    const bookingId = await bookTrip(traveler, tourId, departureId);
    await prisma.booking.updateMany({ where: { id: bookingId }, data: { status: 'CONFIRMED', isPaid: true, endDate: new Date(Date.now() - 3_600_000), paymentExpiresAt: null } });

    const runs = await Promise.all([1, 2, 3, 4].map(() => bookingsService.completeFinishedBookings()));
    expect(runs.reduce((a, b) => a + b, 0)).toBe(1);
    expect(await bookingsService.completeFinishedBookings()).toBe(0);

    expect(await prisma.earning.count({ where: { bookingId } })).toBe(1);
    const mine = await request(app).get('/api/v1/earnings/me').set(bearer(guide.token));
    expect(mine.body.data).toHaveLength(1);
    expect(mine.body.data[0].amount).toBe(250_000);
    const summary = await request(app).get('/api/v1/earnings/me/summary').set(bearer(guide.token));
    expect(summary.body.data).toMatchObject({ totalAmount: 250_000, count: 1 });
  });

  it('nobody earns without an accepted guide; earnings are private and traveler-proof', async () => {
    for (const status of [undefined, 'PENDING'] as const) {
      await resetDatabase();
      const { traveler, tourId, departureId } = await guideSetup(status);
      const bookingId = await bookTrip(traveler, tourId, departureId);
      await completeTrips([bookingId]);
      expect(await prisma.earning.count()).toBe(0);
    }

    await resetDatabase();
    const { traveler, guide, tourId, departureId } = await guideSetup('ACCEPTED');
    const otherGuide = await createUser('TOUR_GUIDE', 'other-guide@example.com');
    await completeTrips([await bookTrip(traveler, tourId, departureId)]);

    expect((await request(app).get('/api/v1/earnings/me').set(bearer(otherGuide.token))).body.data).toHaveLength(0);
    expect((await request(app).get('/api/v1/earnings/me').set(bearer(guide.token))).body.data).toHaveLength(1);
    expect((await request(app).get('/api/v1/earnings/me').set(bearer(traveler.token))).status).toBe(403);
    expect((await request(app).get('/api/v1/earnings/me')).status).toBe(401);
    expect((await request(app).get('/api/v1/earnings/me/summary').set(bearer(otherGuide.token)).query({ guideId: guide.id })).body.data).toEqual({ totalAmount: 0, count: 0, byMonth: [] });
    expect((await request(app).get('/api/v1/earnings/me').set(bearer(otherGuide.token)).query({ guideId: guide.id })).body.data).toEqual([]);
    expect((await request(app).get('/api/v1/earnings/me/summary').set(bearer(traveler.token))).status).toBe(403);
    expect((await request(app).get('/api/v1/earnings/me/summary')).status).toBe(401);
  });

  it('filters inclusive instants and UTC months, keeping summary independent of pagination', async () => {
    const { traveler, guide, tourId, departureId } = await guideSetup('ACCEPTED');
    const bookings = [];
    for (let i = 0; i < 3; i++) bookings.push(await bookTrip(traveler, tourId, departureId));
    await completeTrips(bookings);
    const instants = ['2026-09-30T16:59:59.999Z', '2026-09-30T17:00:00.000Z', '2026-10-01T16:59:59.999Z'];
    for (let i = 0; i < bookings.length; i++) await prisma.earning.update({ where: { bookingId: bookings[i] }, data: { earnedAt: new Date(instants[i]!) } });
    const range = { from: '2026-10-01T00:00:00+07:00', to: '2026-10-01T23:59:59.999+07:00' };
    const list = await request(app).get('/api/v1/earnings/me').set(bearer(guide.token)).query({ ...range, page: 2, limit: 1 });
    expect(list.body.data).toHaveLength(1);
    expect(list.body.meta).toMatchObject({ total: 2, totalPages: 2, page: 2 });
    const summary = await request(app).get('/api/v1/earnings/me/summary').set(bearer(guide.token)).query(range);
    expect(summary.body.data).toEqual({ totalAmount: 500_000, count: 2, byMonth: [
      { month: '2026-10', totalAmount: 250_000, count: 1 }, { month: '2026-09', totalAmount: 250_000, count: 1 },
    ] });
    for (const path of ['/earnings/me', '/earnings/me/summary']) {
      expect((await request(app).get(`/api/v1${path}`).set(bearer(guide.token)).query({ from: range.to, to: range.from })).status).toBe(400);
    }
  });
});
