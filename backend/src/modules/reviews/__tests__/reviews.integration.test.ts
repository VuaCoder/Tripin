import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import { BookingModel } from '../../bookings/bookings.model';
import { bookingsService } from '../../bookings';
import { EarningModel } from '../../earnings/earnings.model';
import { TourModel } from '../../tours/tours.model';
import { bearer, createApprovedTour, createUser, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';

// Real Express app + real MongoDB: reviews, rating statistics and guide earnings after a trip is completed.
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
  await BookingModel.updateMany(
    { _id: { $in: bookingIds } },
    { $set: { status: 'CONFIRMED', isPaid: true, confirmedAt: new Date(), endDate: new Date(Date.now() - 3_600_000) }, $unset: { paymentExpiresAt: 1 } },
  );
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
    expect((await TourModel.findById(tourId))!.ratingCount).toBe(1);

    const moderate = (body: object, token = moderator.token) =>
      request(app).post(`/api/v1/moderation/reviews/${reviewId}/moderate`).set(bearer(token)).send(body);
    expect((await moderate({ hide: true }, traveler.token)).status).toBe(403);
    expect((await moderate({ hide: true })).status).toBe(400); // reason required
    const hides = await Promise.all([moderate({ hide: true, reason: 'Offensive' }), moderate({ hide: true, reason: 'Offensive' })]);
    expect(hides.filter((r) => r.status === 200)).toHaveLength(1);

    expect((await request(app).get('/api/v1/reviews').query({ tourId })).body.data).toHaveLength(0);
    expect(await TourModel.findById(tourId).then((t) => [t!.ratingCount, t!.ratingAvg])).toEqual([0, 0]);
    // The author still sees (and is told about) the hidden review.
    expect((await request(app).get('/api/v1/reviews/me').set(bearer(traveler.token))).body.data).toHaveLength(1);

    expect((await moderate({ hide: false })).status).toBe(200);
    expect(await TourModel.findById(tourId).then((t) => [t!.ratingCount, t!.ratingAvg])).toEqual([1, 4]);
  });

  it('the tour rating stays exact when many travelers review at the same moment', async () => {
    const { tourId, departureId } = await setup();
    const travelers = await Promise.all(Array.from({ length: 8 }, (_, i) => createUser('TRAVELER', `t${i}@example.com`)));
    const bookingIds = await Promise.all(travelers.map((t) => bookTrip(t, tourId, departureId)));
    await completeTrips(bookingIds);

    const ratings = [5, 4, 3, 5, 4, 2, 1, 5];
    const results = await Promise.all(travelers.map((t, i) => review(t.token, bookingIds[i]!, ratings[i])));
    expect(results.every((r) => r.status === 201)).toBe(true);

    const tour = (await TourModel.findById(tourId))!;
    expect(tour.ratingCount).toBe(8);
    expect(tour.ratingAvg).toBeCloseTo(ratings.reduce((a, b) => a + b, 0) / 8, 2);
  });
});

describe('earnings (integration)', () => {
  async function guideSetup(guideStatus: 'ACCEPTED' | 'PENDING' | undefined) {
    const base = await setup();
    const guide = await createUser('TOUR_GUIDE', 'guide@example.com');
    if (guideStatus) {
      await TourModel.updateOne({ _id: base.tourId }, { $set: { guide: { guideId: guide.id, feePerBooking: 250_000, status: guideStatus } } });
    }
    return { ...base, guide };
  }

  it('completing a booking pays the accepted guide exactly once, however often or concurrently the job runs', async () => {
    const { traveler, guide, tourId, departureId } = await guideSetup('ACCEPTED');
    const bookingId = await bookTrip(traveler, tourId, departureId);
    await BookingModel.updateOne(
      { _id: bookingId },
      { $set: { status: 'CONFIRMED', isPaid: true, endDate: new Date(Date.now() - 3_600_000) }, $unset: { paymentExpiresAt: 1 } },
    );

    const runs = await Promise.all([1, 2, 3, 4].map(() => bookingsService.completeFinishedBookings()));
    expect(runs.reduce((a, b) => a + b, 0)).toBe(1);
    expect(await bookingsService.completeFinishedBookings()).toBe(0);

    expect(await EarningModel.countDocuments({ bookingId })).toBe(1);
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
      expect(await EarningModel.countDocuments()).toBe(0);
    }

    await resetDatabase();
    const { traveler, guide, tourId, departureId } = await guideSetup('ACCEPTED');
    const otherGuide = await createUser('TOUR_GUIDE', 'other-guide@example.com');
    await completeTrips([await bookTrip(traveler, tourId, departureId)]);

    expect((await request(app).get('/api/v1/earnings/me').set(bearer(otherGuide.token))).body.data).toHaveLength(0);
    expect((await request(app).get('/api/v1/earnings/me').set(bearer(guide.token))).body.data).toHaveLength(1);
    expect((await request(app).get('/api/v1/earnings/me').set(bearer(traveler.token))).status).toBe(403);
    expect((await request(app).get('/api/v1/earnings/me')).status).toBe(401);
  });
});
