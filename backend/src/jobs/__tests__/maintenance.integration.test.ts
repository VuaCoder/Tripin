import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.PAYOS_CLIENT_ID = 'test-client';
  process.env.PAYOS_API_KEY = 'test-api-key';
  process.env.PAYOS_CHECKSUM_KEY = 'test-checksum-key';
});

import { createApp } from '../../app';
import { defaultTasks } from '../maintenance';
import { bearer, createApprovedTour, createUser, resetDatabase, startDatabase, stopDatabase, loadTour } from '../../test/integration';
import { prisma } from '../../config/database';

// Real Express app + real PostgreSQL: the time-driven rules, run exactly as the scheduler runs them.
const app = createApp();
const task = (name: string) => defaultTasks().find((t) => t.name === name)!;

/** PayOS fake: creating a link always works, the status lookup answers with `remoteStatus`. */
let remoteStatus: { status: string; amountPaid: number } = { status: 'PENDING', amountPaid: 0 };

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(async () => {
  await resetDatabase();
  remoteStatus = { status: 'PENDING', amountPaid: 0 };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: { method?: string }) =>
      init?.method === 'GET'
        ? Response.json({ code: '00', data: remoteStatus })
        : Response.json({ code: '00', desc: 'success', data: { paymentLinkId: 'pl_1', checkoutUrl: 'https://pay.example/1' } }),
    ),
  );
});

const day = 86_400_000;
const contact = { fullName: 'Nguyen Van A', phone: '0901234567' };

async function pendingBooking(extra: object = {}) {
  const agency = await createUser('AGENCY', 'agency@example.com');
  const traveler = await createUser('TRAVELER', 'traveler@example.com');
  const tour = await createApprovedTour(agency.id, { capacity: 10, price: 500_000 });
  const res = await request(app)
    .post('/api/v1/bookings')
    .set(bearer(traveler.token))
    .send({ tourId: tour.tourId, departureId: tour.departureId, participants: 2, contact, ...extra });
  expect(res.status).toBe(201);
  return { agency, traveler, ...tour, bookingId: res.body.data.id as string };
}

describe('maintenance jobs (integration)', () => {
  it('unpaid bookings expire once: seats and promotion redemption come back, parallel sweeps do not double-release', async () => {
    const agency = await createUser('AGENCY', 'agency@example.com');
    await request(app)
      .post('/api/v1/agency/promotions')
      .set(bearer(agency.token))
      .send({
        code: 'SAVE10',
        title: 'Save 10',
        discountType: 'PERCENT',
        discountValue: 10,
        startsAt: new Date(Date.now() - day).toISOString(),
        endsAt: new Date(Date.now() + day).toISOString(),
        usageLimit: 5,
      });
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    const tour = await createApprovedTour(agency.id, { capacity: 10 });
    const booked = await request(app)
      .post('/api/v1/bookings')
      .set(bearer(traveler.token))
      .send({ tourId: tour.tourId, departureId: tour.departureId, participants: 3, contact, promotionCode: 'SAVE10' });
    expect(booked.status).toBe(201);
    const remaining = async () => (await loadTour(tour.tourId))!.departures[0]!.remaining;
    expect(await remaining()).toBe(7);

    // Not due yet: nothing happens.
    expect(await task('bookings.expirePending').run()).toBe(0);

    await prisma.booking.updateMany({ where: { id: booked.body.data.id }, data: { paymentExpiresAt: new Date(Date.now() - 1000) } });
    const runs = await Promise.all([1, 2, 3].map(() => task('bookings.expirePending').run() as Promise<number>));
    expect(runs.reduce((a, b) => a + b, 0)).toBe(1);

    const booking = (await prisma.booking.findUnique({ where: { id: booked.body.data.id } }))!;
    expect(booking.status).toBe('CANCELLED');
    expect(booking.cancelReason).toBe('PAYMENT_EXPIRED');
    expect(await remaining()).toBe(10);
    expect((await prisma.promotion.findFirst({ where: { code: 'SAVE10' } }))!.usedCount).toBe(0);
  });

  it('a payment link past its expiry is closed after asking the gateway; a payment the gateway says is PAID is settled instead', async () => {
    const { traveler, bookingId } = await pendingBooking();
    await request(app).post(`/api/v1/payments/bookings/${bookingId}/checkout`).set(bearer(traveler.token));
    await prisma.payment.updateMany({ where: {}, data: { expiresAt: new Date(Date.now() - 1000) } });

    // The gateway still says PENDING: the sweep expires the payment.
    expect(await task('payments.expireStale').run()).toBe(1);
    expect((await prisma.payment.findFirst())!.status).toBe('EXPIRED');
    expect(await task('payments.expireStale').run()).toBe(0);
  });

  it('a missed webhook is recovered by the sweep: the gateway reports PAID, so the booking is confirmed once', async () => {
    const { traveler, bookingId } = await pendingBooking();
    await request(app).post(`/api/v1/payments/bookings/${bookingId}/checkout`).set(bearer(traveler.token));
    const payment = (await prisma.payment.findFirst())!;
    await prisma.payment.updateMany({ where: {}, data: { expiresAt: new Date(Date.now() - 1000) } });
    remoteStatus = { status: 'PAID', amountPaid: payment.amount };

    await Promise.all([task('payments.expireStale').run(), task('payments.expireStale').run()]);
    expect((await prisma.payment.findUnique({ where: { id: payment.id } }))!.status).toBe('PAID');
    expect((await prisma.booking.findUnique({ where: { id: bookingId } }))!.status).toBe('CONFIRMED');
    expect(await task('payments.retryUnfulfilled').run()).toBe(0); // already fulfilled by the sweep
  });

  it('every scheduled task runs cleanly on an empty database, concurrently and repeatedly', async () => {
    const tasks = defaultTasks();
    expect(tasks.map((t) => t.name).sort()).toEqual([
      'auth.purgeExpired',
      'bookings.completeFinished',
      'bookings.expirePending',
      'notifications.purgeOld',
      'payments.expireStale',
      'payments.retryUnfulfilled',
      'subscriptions.cancelAbandoned',
      'subscriptions.expireEnded',
    ]);
    for (let round = 0; round < 2; round += 1) {
      const results = await Promise.all(tasks.map((t) => t.run()));
      expect(results.every((r) => r === 0)).toBe(true);
    }
  });
});
