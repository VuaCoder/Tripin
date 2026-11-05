import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.PAYOS_CLIENT_ID = 'test-client';
  process.env.PAYOS_API_KEY = 'test-api-key';
  process.env.PAYOS_CHECKSUM_KEY = 'test-checksum-key';
});

import { createApp } from '../../../app';
import { bearer, createApprovedTour, createUser, resetDatabase, startDatabase, stopDatabase, stubPayosApi, loadTour, signedPayosWebhook } from '../../../test/integration';
import { prisma } from '../../../config/database';
import { numericRecord } from '../../../utils/money';
import { bookingsRepository } from '../bookings.repository';

// Real Express app + real PostgreSQL: whatever the inputs, the money stored on a booking adds up, in whole VND, never negative.
const app = createApp();

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(async () => {
  await resetDatabase();
  stubPayosApi();
});

/** Small deterministic PRNG (mulberry32) so a failing case can be replayed from its seed. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(random: () => number, items: readonly T[]) => items[Math.floor(random() * items.length)]!;
const between = (random: () => number, min: number, max: number) => min + Math.floor(random() * (max - min + 1));

const day = 86_400_000;
const contact = { fullName: 'Nguyen Van A', phone: '0901234567' };

async function promotion(agencyToken: string, code: string, body: object) {
  const res = await request(app)
    .post('/api/v1/agency/promotions')
    .set(bearer(agencyToken))
    .send({ code, title: `Promo ${code}`, startsAt: new Date(Date.now() - day).toISOString(), endsAt: new Date(Date.now() + day).toISOString(), ...body });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
}

describe('money invariants (integration)', () => {
  it.each([50_000_000, 1_000_000_000])('cart to booking to paid e-ticket preserves 50 x %i VND', async (price) => {
    const agency = await createUser('AGENCY', 'agency@example.com');
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    const admin = await createUser('SUPER_ADMIN', 'admin@example.com');
    expect((await request(app).put('/api/v1/admin/settings/commission').set(bearer(admin.token)).send({ ratePercent: 12.34 })).status).toBe(200);
    const { tourId, departureId } = await createApprovedTour(agency.id, { price, capacity: 50 });
    expect((await request(app).post('/api/v1/cart/items').set(bearer(traveler.token)).send({ tourId, departureId, participants: 50 })).status).toBe(201);
    const cart = await request(app).get('/api/v1/cart').set(bearer(traveler.token));
    expect(cart.body.data.totals.subtotal).toBe(price * 50);
    const booked = await request(app).post('/api/v1/bookings').set(bearer(traveler.token)).send({ tourId, departureId, participants: 50, contact });
    expect(booked.status, JSON.stringify(booked.body)).toBe(201);
    expect(booked.body.data.totalAmount).toBe(price * 50);
    const stored = (await prisma.booking.findUnique({ where: { id: booked.body.data.id } }))!;
    expect(stored.totalAmount).toBe(BigInt(price) * 50n);
    expect(stored.commissionAmount).toBe(stored.totalAmount * 1234n / 10000n);
    expect(stored.agencyAmount + stored.commissionAmount).toBe(stored.totalAmount);
    expect((await request(app).post(`/api/v1/payments/bookings/${stored.id}/checkout`).set(bearer(traveler.token))).status).toBe(201);
    const payment = (await prisma.payment.findFirst())!;
    expect(payment.amount).toBe(stored.totalAmount);
    const webhook = await request(app).post('/api/v1/payments/webhooks/payos').send(signedPayosWebhook(Number(payment.providerOrderCode), payment.amount));
    expect(webhook.status).toBe(200);
    expect((await prisma.booking.findUnique({ where: { id: stored.id } }))!.status).toBe('CONFIRMED');
    const ticket = await request(app).get(`/api/v1/e-tickets/booking/${stored.id}`).set(bearer(traveler.token));
    expect(ticket.status, JSON.stringify(ticket.body)).toBe(200);
    expect(await prisma.eTicket.count({ where: { bookingId: stored.id } })).toBe(1);
    const totals = await bookingsRepository.revenueTotals(agency.id);
    expect(totals.gross).toBe(price * 50);
  });

  it('stores a voucher discount above Int32 and previews a 50-billion subtotal', async () => {
    const agency = await createUser('AGENCY', 'agency@example.com');
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    const { tourId, departureId } = await createApprovedTour(agency.id, { price: 1_000_000_000, capacity: 50 });
    await promotion(agency.token, 'BIGSAVE', { discountType: 'FIXED', discountValue: 3_000_000_000, minOrderAmount: 50_000_000_000 });
    const preview = await request(app).get('/api/v1/promotions/preview').query({ code: 'BIGSAVE', tourId, subtotal: 50_000_000_000 }).set(bearer(traveler.token));
    expect(preview.status, JSON.stringify(preview.body)).toBe(200);
    expect(preview.body.data.discountAmount).toBe(3_000_000_000);
    const booked = await request(app).post('/api/v1/bookings').set(bearer(traveler.token)).send({ tourId, departureId, participants: 50, contact, promotionCode: 'BIGSAVE' });
    expect(booked.status, JSON.stringify(booked.body)).toBe(201);
    expect(booked.body.data.totalAmount).toBe(47_000_000_000);
    expect((await prisma.booking.findUnique({ where: { id: booked.body.data.id } }))!.discountAmount).toBe(3_000_000_000n);
  });

  it('reports multiple large bookings beyond the per-booking ceiling without clamping', async () => {
    const agency = await createUser('AGENCY', 'agency@example.com');
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    const { tourId, departureId } = await createApprovedTour(agency.id, { price: 1_000_000_000, capacity: 100 });
    for (let i = 0; i < 2; i++) {
      const booked = await request(app).post('/api/v1/bookings').set(bearer(traveler.token)).send({ tourId, departureId, participants: 50, contact });
      expect(booked.status).toBe(201);
      await prisma.booking.update({ where: { id: booked.body.data.id }, data: { status: 'CONFIRMED', isPaid: true, confirmedAt: new Date() } });
    }
    const totals = await bookingsRepository.revenueTotals(agency.id);
    expect(totals.gross).toBe(100_000_000_000);
    const daily = await bookingsRepository.dailyNet(agency.id, new Date(0));
    expect(daily.reduce((sum, row) => sum + row.net, 0)).toBe(totals.net);
    const monthly = await bookingsRepository.monthlyTotals(new Date(0));
    expect(monthly.reduce((sum, row) => sum + row.gross, 0)).toBe(totals.gross);
    expect((await bookingsRepository.topTours(agency.id, 5))[0]!.net).toBe(totals.net);
  });

  it('randomised bookings: totals add up, in whole VND, never negative, commission snapshot is exact', async () => {
    const admin = await createUser('SUPER_ADMIN', 'admin@example.com');
    const agency = await createUser('AGENCY', 'agency@example.com');
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    const random = rng(20261002);

    await promotion(agency.token, 'PCT7', { discountType: 'PERCENT', discountValue: 7, usageLimitPerUser: 100 });
    await promotion(agency.token, 'PCT33CAP', { discountType: 'PERCENT', discountValue: 33, maxDiscountAmount: 150_000, usageLimitPerUser: 100 });
    await promotion(agency.token, 'FIX120K', { discountType: 'FIXED', discountValue: 120_000, usageLimitPerUser: 100 });
    await promotion(agency.token, 'MIN1M', { discountType: 'PERCENT', discountValue: 15, minOrderAmount: 1_000_000, usageLimitPerUser: 100 });

    let checked = 0;
    for (let round = 0; round < 6; round += 1) {
      // A new commission rate and a new tour (odd prices to provoke rounding) each round.
      const ratePercent = pick(random, [0, 0.01, 3.33, 7.5, 10, 12.34, 33.33, 99.99, 100]);
      expect((await request(app).put('/api/v1/admin/settings/commission').set(bearer(admin.token)).send({ ratePercent })).status).toBe(200);
      const price = between(random, 1, 5_000_000) * (round % 2 ? 1 : 1) + 1; // 2 .. 5,000,001
      const { tourId, departureId } = await createApprovedTour(agency.id, { capacity: 500, price });

      for (let i = 0; i < 8; i += 1) {
        const participants = between(random, 1, 9);
        const code = pick(random, [undefined, 'PCT7', 'PCT33CAP', 'FIX120K', 'MIN1M']);
        const res = await request(app)
          .post('/api/v1/bookings')
          .set(bearer(traveler.token))
          .send({ tourId, departureId, participants, contact, ...(code ? { promotionCode: code } : {}) });
        if (res.status === 409 && ['PROMOTION_MIN_ORDER', 'PROMOTION_USER_LIMIT_REACHED'].includes(res.body.error?.code)) continue; // legitimately refused
        expect(res.status, `seed round ${round}/${i}: ${JSON.stringify(res.body)}`).toBe(201);

        const stored = (await prisma.booking.findUnique({ where: { id: res.body.data.id } }))!;
        const b = numericRecord(stored);
        const label = `price ${price} x ${participants} code ${code} rate ${ratePercent}%`;
        for (const field of [b.unitPrice, b.subtotal, b.discountAmount, b.totalAmount, b.commissionAmount, b.agencyAmount, b.commissionBps]) {
          expect(Number.isInteger(field), label).toBe(true);
          expect(field, label).toBeGreaterThanOrEqual(0);
        }
        expect(b.unitPrice, label).toBe(price);
        expect(b.subtotal, label).toBe(price * participants);
        expect(b.discountAmount, label).toBeLessThanOrEqual(b.subtotal);
        expect(b.totalAmount, label).toBe(b.subtotal - b.discountAmount);
        expect(b.commissionBps, label).toBe(Math.round(ratePercent * 100));
        expect(stored.commissionAmount, label).toBe(stored.totalAmount * BigInt(stored.commissionBps) / 10_000n);
        expect(b.commissionAmount + b.agencyAmount, label).toBe(b.totalAmount);
        if (b.promotionCode) expect(b.discountAmount, label).toBeGreaterThan(0);
        else expect(b.discountAmount, label).toBe(0);
        // The DTO shows the same numbers the database holds.
        expect(res.body.data.totalAmount, label).toBe(b.totalAmount);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(30);
  });

  it('the payment charges exactly the booking total, taken from the server', async () => {
    const agency = await createUser('AGENCY', 'agency@example.com');
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    await promotion(agency.token, 'PCT7', { discountType: 'PERCENT', discountValue: 7 });
    const { tourId, departureId } = await createApprovedTour(agency.id, { price: 1_234_567 });
    const booked = await request(app)
      .post('/api/v1/bookings')
      .set(bearer(traveler.token))
      .send({ tourId, departureId, participants: 3, contact, promotionCode: 'PCT7' });
    const total = booked.body.data.totalAmount as number;
    expect(total).toBe(3 * 1_234_567 - Math.floor((3 * 1_234_567 * 7) / 100));

    const checkout = await request(app).post(`/api/v1/payments/bookings/${booked.body.data.id}/checkout`).set(bearer(traveler.token)).send({ amount: 1 });
    expect(checkout.status).toBe(201);
    expect((await prisma.payment.findFirst())!.amount).toBe(BigInt(total));
  });

  it('an order that would be free cannot be booked online (nothing to pay): seats and redemption stay untouched', async () => {
    const agency = await createUser('AGENCY', 'agency@example.com');
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    await promotion(agency.token, 'FIX9M', { discountType: 'FIXED', discountValue: 9_000_000 });
    await promotion(agency.token, 'ALL100', { discountType: 'PERCENT', discountValue: 100 });
    const paid = await createApprovedTour(agency.id, { price: 500_000, capacity: 10 });
    const free = await createApprovedTour(agency.id, { price: 0, capacity: 10 });
    const book = (tour: { tourId: string; departureId: string }, extra: object = {}) =>
      request(app).post('/api/v1/bookings').set(bearer(traveler.token)).send({ tourId: tour.tourId, departureId: tour.departureId, participants: 2, contact, ...extra });

    for (const res of [await book(paid, { promotionCode: 'FIX9M' }), await book(paid, { promotionCode: 'ALL100' }), await book(free)]) {
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BOOKING_AMOUNT_TOO_LOW');
    }
    expect(await prisma.booking.count()).toBe(0);
    expect((await loadTour(paid.tourId))!.departures[0]!.remaining).toBe(10);
    expect((await loadTour(free.tourId))!.departures[0]!.remaining).toBe(10);
    expect(await prisma.promotion.findMany().then((rows) => rows.map((p) => p.usedCount))).toEqual([0, 0]);

    // A huge but not total discount still works and leaves a payable (and checkout-able) booking.
    await promotion(agency.token, 'FIX999K', { discountType: 'FIXED', discountValue: 999_999 });
    const almost = await book(paid, { promotionCode: 'FIX999K' });
    expect(almost.status).toBe(201);
    expect(almost.body.data.totalAmount).toBe(1);
    expect((await request(app).post(`/api/v1/payments/bookings/${almost.body.data.id}/checkout`).set(bearer(traveler.token))).status).toBe(201);
  });
});
