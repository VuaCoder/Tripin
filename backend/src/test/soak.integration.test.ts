import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.PAYOS_CLIENT_ID = 'test-client';
  process.env.PAYOS_API_KEY = 'test-api-key';
  process.env.PAYOS_CHECKSUM_KEY = 'test-checksum-key';
});

import { createApp } from '../app';
import { bookingsService } from '../modules/bookings';
import { BookingModel } from '../modules/bookings/bookings.model';
import { ETicketModel } from '../modules/e-tickets/e-tickets.model';
import { NotificationModel } from '../modules/notifications/notifications.model';
import { paymentsService } from '../modules/payments';
import { PaymentModel } from '../modules/payments/payments.model';
import { PromotionModel } from '../modules/promotions/promotions.model';
import { TourModel } from '../modules/tours/tours.model';
import { bearer, createApprovedTour, createUser, resetDatabase, signedPayosWebhook, startDatabase, stopDatabase, stubPayosApi } from './integration';

// A randomised, parallel mixed workload on a real database. Whatever interleaving happened, the books must balance.
const app = createApp();

beforeAll(async () => {
  await startDatabase();
  stubPayosApi();
}, 120_000);
afterAll(stopDatabase);

function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const day = 86_400_000;
const contact = { fullName: 'Nguyen Van A', phone: '0901234567' };

describe('mixed-workload soak (real database)', () => {
  it.each([1002, 7, 2026, 31337])('seed %i: after random parallel bookings, cancellations, payments, replays and sweeps, seats, promotions, payments, bookings and tickets agree', async (seed) => {
    await resetDatabase();
    const random = rng(seed);
    const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)]!;
    const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));

    const agency = await createUser('AGENCY', 'agency@example.com');
    const travelers = await Promise.all(Array.from({ length: 10 }, (_, i) => createUser('TRAVELER', `t${i}@example.com`)));
    const byId = new Map(travelers.map((t) => [t.id, t]));
    const { tourId, departureId } = await createApprovedTour(agency.id, { capacity: 40, price: 300_000, daysAhead: 20 });

    for (const [code, body] of [
      ['LIM3', { discountType: 'FIXED', discountValue: 50_000, usageLimit: 3 }],
      ['PCT10', { discountType: 'PERCENT', discountValue: 10 }],
    ] as const) {
      const res = await request(app)
        .post('/api/v1/agency/promotions')
        .set(bearer(agency.token))
        .send({ code, title: `Promo ${code}`, startsAt: new Date(Date.now() - day).toISOString(), endsAt: new Date(Date.now() + 30 * day).toISOString(), ...body });
      expect(res.status).toBe(201);
    }

    const serverErrors: string[] = [];
    const track = async (label: string, work: Promise<{ status: number }>) => {
      try {
        const res = await work;
        if (res.status >= 500) serverErrors.push(`${label} -> ${res.status}`);
      } catch (error) {
        serverErrors.push(`${label} threw ${(error as Error).message}`);
      }
    };

    const rounds = 12;
    for (let round = 0; round < rounds; round += 1) {
      const bookings = await BookingModel.find().lean();
      const payments = await PaymentModel.find().lean();
      const ops: Promise<unknown>[] = [];

      // New bookings (some with promotions), some retried with a fixed request id.
      for (let i = 0; i < 6; i += 1) {
        const traveler = pick(travelers);
        const promo = pick([undefined, undefined, 'LIM3', 'PCT10']);
        const clientRequestId = random() < 0.3 ? `soak-${round}-${between(1, 3)}-${traveler.id.slice(-6)}` : undefined;
        ops.push(
          track(
            'book',
            Promise.resolve(
              request(app)
                .post('/api/v1/bookings')
                .set(bearer(traveler.token))
                .send({ tourId, departureId, participants: between(1, 4), contact, ...(promo ? { promotionCode: promo } : {}), ...(clientRequestId ? { clientRequestId } : {}) }),
            ),
          ),
        );
      }

      // Cancellations (the same booking may be cancelled twice in parallel).
      for (const booking of bookings.filter((b) => b.status === 'PENDING' || b.status === 'CONFIRMED').filter(() => random() < 0.25)) {
        const owner = byId.get(String(booking.travelerId))!;
        for (let k = 0; k < between(1, 2); k += 1) {
          ops.push(track('cancel', Promise.resolve(request(app).post(`/api/v1/bookings/${booking._id}/cancel`).set(bearer(owner.token)).send({}))));
        }
      }

      // Checkouts (double click possible), then webhooks (replayed) for payments that exist.
      for (const booking of bookings.filter((b) => b.status === 'PENDING').filter(() => random() < 0.6)) {
        const owner = byId.get(String(booking.travelerId))!;
        for (let k = 0; k < between(1, 2); k += 1) {
          ops.push(track('checkout', Promise.resolve(request(app).post(`/api/v1/payments/bookings/${booking._id}/checkout`).set(bearer(owner.token)))));
        }
      }
      for (const payment of payments.filter((p) => p.status === 'PENDING').filter(() => random() < 0.6)) {
        for (let k = 0; k < between(1, 3); k += 1) {
          ops.push(track('webhook', Promise.resolve(request(app).post('/api/v1/payments/webhooks/payos').send(signedPayosWebhook(payment.providerOrderCode, payment.amount)))));
        }
      }

      // Time-driven rules: force some bookings past their payment window / end date, then run the sweeps concurrently.
      for (const booking of bookings.filter((b) => b.status === 'PENDING').filter(() => random() < 0.15)) {
        await BookingModel.collection.updateOne({ _id: booking._id }, { $set: { paymentExpiresAt: new Date(Date.now() - 1000) } });
      }
      for (const booking of bookings.filter((b) => b.status === 'CONFIRMED').filter(() => random() < 0.15)) {
        await BookingModel.collection.updateOne({ _id: booking._id }, { $set: { endDate: new Date(Date.now() - 1000) } });
      }
      if (random() < 0.7) ops.push(bookingsService.expirePendingBookings());
      if (random() < 0.5) ops.push(bookingsService.completeFinishedBookings());
      if (random() < 0.5) ops.push(paymentsService.retryUnfulfilled());
      if (random() < 0.3) ops.push(paymentsService.expireStalePayments());
      // The agency raises capacity while all this happens.
      if (random() < 0.3) {
        const date = (await TourModel.findById(tourId))!.departures[0]!.date.toISOString();
        ops.push(track('availability', Promise.resolve(request(app).put(`/api/v1/agency/tours/${tourId}/availability`).set(bearer(agency.token)).send({ departures: [{ id: departureId, date, capacity: 40 + round, isOpen: true }] }))));
      }

      // Shuffle so the interleaving differs per round.
      ops.sort(() => random() - 0.5);
      await Promise.all(ops);
    }

    // Let the system settle: pending work is finished by the same sweeps the scheduler runs.
    await paymentsService.retryUnfulfilled();
    await paymentsService.retryUnfulfilled();

    expect(serverErrors).toEqual([]);

    // ---- the books must balance ----
    const bookings = await BookingModel.find().lean();
    const payments = await PaymentModel.find().lean();
    const tour = (await TourModel.findById(tourId))!;
    const dep = tour.departures[0]!;
    expect(bookings.length).toBeGreaterThan(20); // the soak actually did something
    const statuses = new Set(bookings.map((b) => b.status));
    expect(statuses.has('CANCELLED') && (statuses.has('CONFIRMED') || statuses.has('COMPLETED')), `statuses reached: ${[...statuses].join(',')}`).toBe(true);
    expect(payments.some((p) => p.status === 'PAID')).toBe(true);

    // 1. Seats: free seats = capacity - seats held by live bookings; never negative, never above capacity.
    const held = bookings.filter((b) => b.status !== 'CANCELLED').reduce((sum, b) => sum + b.participants, 0);
    expect(dep.remaining, 'remaining seats').toBe(dep.capacity - held);
    expect(dep.remaining).toBeGreaterThanOrEqual(0);
    expect(dep.remaining).toBeLessThanOrEqual(dep.capacity);

    // 2. Promotions: the counter equals the number of live bookings carrying the code, and respects the limit.
    for (const promotion of await PromotionModel.find()) {
      const live = bookings.filter((b) => b.status !== 'CANCELLED' && b.promotion && String(b.promotion.promotionId) === promotion.id).length;
      expect(promotion.usedCount, `promotion ${promotion.code}`).toBe(live);
      if (promotion.usageLimit != null) expect(promotion.usedCount).toBeLessThanOrEqual(promotion.usageLimit);
    }

    // 3. Payments <-> bookings.
    const paymentsByBooking = new Map<string, typeof payments>();
    for (const payment of payments) paymentsByBooking.set(String(payment.referenceId), [...(paymentsByBooking.get(String(payment.referenceId)) ?? []), payment]);
    for (const booking of bookings) {
      const mine = paymentsByBooking.get(String(booking._id)) ?? [];
      const paid = mine.filter((p) => p.status === 'PAID');
      expect(mine.filter((p) => p.status === 'PENDING').length, `open payments of ${booking.bookingCode}`).toBeLessThanOrEqual(1);
      if (booking.status === 'CONFIRMED' || booking.status === 'COMPLETED') {
        expect(booking.isPaid, booking.bookingCode).toBe(true);
        expect(paid.length, `paid payments of confirmed ${booking.bookingCode}`).toBeGreaterThanOrEqual(1);
      }
      if (paid.length > 0 && booking.status === 'CANCELLED') expect(booking.refundRequired, `refund flag of ${booking.bookingCode}`).toBe(true);
      if (booking.status === 'PENDING') expect(paid.length, `PENDING ${booking.bookingCode} must have no paid payment`).toBe(0);
      for (const payment of paid) {
        expect(payment.amount).toBe(booking.totalAmount);
        expect(payment.fulfilledAt, `paid payment of ${booking.bookingCode} was fulfilled`).toBeInstanceOf(Date);
      }
    }

    // 4. Tickets: at most one per booking, and one for every booking that was ever confirmed.
    const tickets = await ETicketModel.find().lean();
    const perBooking = new Map<string, number>();
    for (const ticket of tickets) perBooking.set(String(ticket.bookingId), (perBooking.get(String(ticket.bookingId)) ?? 0) + 1);
    expect([...perBooking.values()].every((n) => n === 1)).toBe(true);
    for (const booking of bookings.filter((b) => b.confirmedAt)) expect(perBooking.get(String(booking._id)), `ticket of ${booking.bookingCode}`).toBe(1);
    for (const booking of bookings.filter((b) => !b.confirmedAt && !b.isPaid)) expect(perBooking.get(String(booking._id)), `no ticket for unpaid ${booking.bookingCode}`).toBeUndefined();

    // 5. Notifications: exactly one "payment received" per fulfilled payment.
    const fulfilled = payments.filter((p) => p.fulfilledAt).length;
    expect(await NotificationModel.countDocuments({ type: 'PAYMENT_SUCCEEDED' })).toBe(fulfilled);
  }, 180_000);
});
