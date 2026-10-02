import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import { BookingModel } from '../../bookings/bookings.model';
import { TourModel } from '../../tours/tours.model';
import { PromotionModel } from '../promotions.model';
import { bearer, createApprovedTour, createUser, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';

// Real Express app + real MongoDB: promotion redemption must be exact under parallel bookings.
const app = createApp();

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);

const contact = { fullName: 'Nguyen Van A', phone: '0901234567' };
const day = 86_400_000;
const promoBody = (overrides: object = {}) => ({
  code: 'SUMMER10',
  title: 'Summer 10%',
  discountType: 'PERCENT',
  discountValue: 10,
  startsAt: new Date(Date.now() - day).toISOString(),
  endsAt: new Date(Date.now() + 30 * day).toISOString(),
  ...overrides,
});
const book = (token: string, tourId: string, departureId: string, extra: object = {}) =>
  request(app).post('/api/v1/bookings').set(bearer(token)).send({ tourId, departureId, participants: 1, contact, ...extra });

async function setup(capacity = 10) {
  const agency = await createUser('AGENCY', 'agency@example.com');
  const tour = await createApprovedTour(agency.id, { capacity, price: 1_000_000 });
  return { agency, ...tour };
}

describe('promotions (integration)', () => {
  it('an agency creates, lists and edits only its own promotions; duplicate codes conflict', async () => {
    const { agency } = await setup();
    const other = await createUser('AGENCY', 'other@example.com');

    const created = await request(app).post('/api/v1/agency/promotions').set(bearer(agency.token)).send(promoBody());
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    expect((await request(app).post('/api/v1/agency/promotions').set(bearer(other.token)).send(promoBody())).status).toBe(409);
    expect((await request(app).get(`/api/v1/agency/promotions/${id}`).set(bearer(other.token))).status).toBe(404);
    expect((await request(app).patch(`/api/v1/agency/promotions/${id}`).set(bearer(other.token)).send({ isActive: false })).status).toBe(404);
    expect((await request(app).get('/api/v1/agency/promotions').set(bearer(other.token))).body.data).toHaveLength(0);
    expect((await request(app).get('/api/v1/agency/promotions').set(bearer(agency.token))).body.data).toHaveLength(1);

    // Travelers cannot manage promotions; platform promotions are for the Super admin only.
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    expect((await request(app).post('/api/v1/agency/promotions').set(bearer(traveler.token)).send(promoBody({ code: 'X1234' }))).status).toBe(403);
    expect((await request(app).post('/api/v1/admin/promotions').set(bearer(agency.token)).send(promoBody({ code: 'PLAT10' }))).status).toBe(403);
  });

  it('never redeems more than usageLimit under parallel bookings, and failed bookings give their seats back', async () => {
    const { agency, tourId, departureId } = await setup(10);
    await request(app).post('/api/v1/agency/promotions').set(bearer(agency.token)).send(promoBody({ usageLimit: 2 }));
    const travelers = await Promise.all(Array.from({ length: 6 }, (_, i) => createUser('TRAVELER', `t${i}@example.com`)));

    const results = await Promise.all(travelers.map((t) => book(t.token, tourId, departureId, { promotionCode: 'SUMMER10' })));
    const ok = results.filter((r) => r.status === 201);
    const refused = results.filter((r) => r.status === 409);
    expect(ok).toHaveLength(2);
    expect(refused).toHaveLength(4);
    expect(refused.every((r) => r.body.error.code === 'PROMOTION_EXHAUSTED')).toBe(true);
    expect(ok.every((r) => r.body.data.discountAmount === 100_000 && r.body.data.totalAmount === 900_000)).toBe(true);

    expect((await PromotionModel.findOne({ code: 'SUMMER10' }))!.usedCount).toBe(2);
    expect(await BookingModel.countDocuments()).toBe(2);
    // The four refused attempts reserved seats first; compensation must have returned them.
    expect((await TourModel.findById(tourId))!.departures[0]!.remaining).toBe(8);
  });

  it('cancelling a booking releases the redemption exactly once', async () => {
    const { agency, tourId, departureId } = await setup(10);
    await request(app).post('/api/v1/agency/promotions').set(bearer(agency.token)).send(promoBody({ usageLimit: 1 }));
    const traveler = await createUser('TRAVELER', 'traveler@example.com');

    const first = await book(traveler.token, tourId, departureId, { promotionCode: 'SUMMER10' });
    expect(first.status).toBe(201);
    expect((await book(traveler.token, tourId, departureId, { promotionCode: 'SUMMER10' })).status).toBe(409);

    const cancels = await Promise.all(
      [1, 2, 3].map(() => request(app).post(`/api/v1/bookings/${first.body.data.id}/cancel`).set(bearer(traveler.token)).send({})),
    );
    expect(cancels.filter((r) => r.status === 200)).toHaveLength(1);
    expect((await PromotionModel.findOne({ code: 'SUMMER10' }))!.usedCount).toBe(0);

    expect((await book(traveler.token, tourId, departureId, { promotionCode: 'SUMMER10' })).status).toBe(201);
  });

  it("an agency promotion does not apply to another agency's tour; a platform promotion applies everywhere", async () => {
    const { agency } = await setup();
    const rival = await createUser('AGENCY', 'rival@example.com');
    const rivalTour = await createApprovedTour(rival.id, { price: 2_000_000 });
    const admin = await createUser('SUPER_ADMIN', 'admin@example.com');
    const traveler = await createUser('TRAVELER', 'traveler@example.com');

    await request(app).post('/api/v1/agency/promotions').set(bearer(agency.token)).send(promoBody({ code: 'MINE10' }));
    const foreign = await book(traveler.token, rivalTour.tourId, rivalTour.departureId, { promotionCode: 'MINE10' });
    expect(foreign.status).toBe(409);
    expect(foreign.body.error.code).toBe('PROMOTION_NOT_APPLICABLE');

    const platform = await request(app)
      .post('/api/v1/admin/promotions')
      .set(bearer(admin.token))
      .send(promoBody({ code: 'PLAT50K', discountType: 'FIXED', discountValue: 50_000 }));
    expect(platform.status).toBe(201);
    const ok = await book(traveler.token, rivalTour.tourId, rivalTour.departureId, { promotionCode: 'PLAT50K' });
    expect(ok.status).toBe(201);
    expect(ok.body.data.totalAmount).toBe(1_950_000);
  });

  it('preview never consumes a redemption; the client cannot choose the discount', async () => {
    const { agency, tourId, departureId } = await setup();
    await request(app).post('/api/v1/agency/promotions').set(bearer(agency.token)).send(promoBody({ usageLimit: 1 }));
    const traveler = await createUser('TRAVELER', 'traveler@example.com');

    for (let i = 0; i < 3; i += 1) {
      const preview = await request(app)
        .get('/api/v1/promotions/preview')
        .query({ code: 'summer10', tourId, subtotal: 1_000_000 })
        .set(bearer(traveler.token));
      expect(preview.status).toBe(200);
      expect(preview.body.data.discountAmount).toBe(100_000);
    }
    expect((await PromotionModel.findOne({ code: 'SUMMER10' }))!.usedCount).toBe(0);

    const tampered = await book(traveler.token, tourId, departureId, { promotionCode: 'SUMMER10', discountAmount: 999_999 });
    expect(tampered.status).toBe(400);
  });

  it('expired, inactive and not-yet-started promotions are refused with a precise code', async () => {
    const { agency, tourId, departureId } = await setup();
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    const create = (body: object) => request(app).post('/api/v1/agency/promotions').set(bearer(agency.token)).send(promoBody(body));

    await create({ code: 'FUTURE1', startsAt: new Date(Date.now() + 5 * day).toISOString(), endsAt: new Date(Date.now() + 9 * day).toISOString() });
    const off = await create({ code: 'OFF1' });
    await request(app).patch(`/api/v1/agency/promotions/${off.body.data.id}`).set(bearer(agency.token)).send({ isActive: false });

    const future = await book(traveler.token, tourId, departureId, { promotionCode: 'FUTURE1' });
    expect(future.body.error.code).toBe('PROMOTION_NOT_STARTED');
    const inactive = await book(traveler.token, tourId, departureId, { promotionCode: 'OFF1' });
    expect(inactive.body.error.code).toBe('PROMOTION_INACTIVE');
    const unknown = await book(traveler.token, tourId, departureId, { promotionCode: 'NOPE123' });
    expect(unknown.status).toBe(404);
    expect((await TourModel.findById(tourId))!.departures[0]!.remaining).toBe(10);
  });
});
