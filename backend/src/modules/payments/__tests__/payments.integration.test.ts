import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Credentials must exist before config/env.ts is first imported.
vi.hoisted(() => {
  process.env.PAYOS_CLIENT_ID = 'test-client';
  process.env.PAYOS_API_KEY = 'test-api-key';
  process.env.PAYOS_CHECKSUM_KEY = 'test-checksum-key';
});

import { createApp } from '../../../app';
import { hmacSha256 } from '../../../utils/crypto';
import { canonicalize } from '../providers/payos.provider';
import { paymentsService } from '..';
import { bearer, createApprovedTour, createUser, resetDatabase, startDatabase, stopDatabase, loadTour } from '../../../test/integration';
import { prisma } from '../../../config/database';

// Real Express app + real PostgreSQL; only the PayOS HTTP API is faked.
const app = createApp();

beforeAll(async () => {
  await startDatabase();
}, 120_000);
afterAll(stopDatabase);
beforeEach(async () => {
  await resetDatabase();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ code: '00', desc: 'success', data: { paymentLinkId: 'pl_test_1', checkoutUrl: 'https://pay.example/checkout/1' } })),
  );
});

const contact = { fullName: 'Nguyen Van A', phone: '0901234567' };

async function pendingBooking(participants = 2) {
  const agency = await createUser('AGENCY', 'agency@example.com');
  const traveler = await createUser('TRAVELER', 'traveler@example.com');
  const tour = await createApprovedTour(agency.id, { capacity: 10, price: 500_000 });
  const created = await request(app)
    .post('/api/v1/bookings')
    .set(bearer(traveler.token))
    .send({ tourId: tour.tourId, departureId: tour.departureId, participants, contact });
  expect(created.status).toBe(201);
  return { agency, traveler, ...tour, bookingId: created.body.data.id as string };
}

async function checkout(token: string, bookingId: string) {
  return request(app).post(`/api/v1/payments/bookings/${bookingId}/checkout`).set(bearer(token));
}

/** A webhook body signed exactly like PayOS does. */
function signedWebhook(orderCode: number, amount: number, overrides: { success?: boolean; code?: string } = {}) {
  const data = {
    orderCode,
    amount,
    description: 'TRIPRI',
    accountNumber: '123',
    reference: 'FT123',
    transactionDateTime: '2026-10-02 10:00:00',
    currency: 'VND',
    paymentLinkId: 'pl_test_1',
    code: overrides.code ?? '00',
    desc: 'success',
  };
  return { code: overrides.code ?? '00', desc: 'success', success: overrides.success ?? true, data, signature: hmacSha256('test-checksum-key', canonicalize(data)) };
}

const webhook = (body: unknown) => request(app).post('/api/v1/payments/webhooks/payos').send(body as object);

describe('payments (integration)', () => {
  it('checkout charges the amount stored on the server and is idempotent while the link is alive', async () => {
    const { traveler, bookingId } = await pendingBooking(2);

    const first = await checkout(traveler.token, bookingId);
    const second = await checkout(traveler.token, bookingId);
    expect(first.status).toBe(201);
    expect(second.body.data.checkoutUrl).toBe(first.body.data.checkoutUrl);

    const payments = await prisma.payment.findMany();
    expect(payments).toHaveLength(1);
    expect(payments[0]!.amount).toBe(1_000_000);
    expect(payments[0]!.status).toBe('PENDING');
  });

  it('double click: parallel checkouts of one booking create ONE payment and return the same link', async () => {
    const { traveler, bookingId } = await pendingBooking(1);

    const results = await Promise.all(Array.from({ length: 6 }, () => checkout(traveler.token, bookingId)));
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(new Set(results.map((r) => r.body.data.paymentId ?? r.body.data.checkoutUrl)).size).toBe(1);
    expect(await prisma.payment.count()).toBe(1);
  });

  it('an expired payment that the sweep has not closed yet does not block a fresh checkout', async () => {
    const { traveler, bookingId } = await pendingBooking(1);
    expect((await checkout(traveler.token, bookingId)).status).toBe(201);
    await prisma.payment.updateMany({ where: {}, data: { expiresAt: new Date(Date.now() - 1000) } });

    const again = await checkout(traveler.token, bookingId);
    expect(again.status).toBe(201);
    const all = await prisma.payment.findMany({ orderBy: { createdAt: 'asc' } });
    expect(all.map((p) => p.status)).toEqual(['EXPIRED', 'PENDING']);
  });

  it("another traveler cannot start a payment for someone else's booking", async () => {
    const { bookingId } = await pendingBooking();
    const stranger = await createUser('TRAVELER', 'stranger@example.com');
    expect((await checkout(stranger.token, bookingId)).status).toBe(404);
    expect(await prisma.payment.count()).toBe(0);
  });

  it('a valid webhook confirms the booking and issues one e-ticket; replays (even parallel) change nothing', async () => {
    const { traveler, bookingId } = await pendingBooking(2);
    await checkout(traveler.token, bookingId);
    const payment = (await prisma.payment.findFirst())!;

    const body = signedWebhook(Number(payment.providerOrderCode), payment.amount);
    const results = await Promise.all(Array.from({ length: 6 }, () => webhook(body)));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect((await webhook(body)).status).toBe(200);

    const booking = (await prisma.booking.findUnique({ where: { id: bookingId } }))!;
    expect(booking.status).toBe('CONFIRMED');
    expect(booking.isPaid).toBe(true);
    expect(booking.refundRequired).toBe(false);

    const settled = (await prisma.payment.findUnique({ where: { id: payment.id } }))!;
    expect(settled.status).toBe('PAID');
    expect(settled.fulfilledAt).toBeInstanceOf(Date);

    expect(await prisma.eTicket.count({ where: { bookingId } })).toBe(1);
    expect(await prisma.notification.count({ where: { type: 'PAYMENT_SUCCEEDED' } })).toBe(1);
    expect(await prisma.notification.count({ where: { type: 'BOOKING_CONFIRMED', userId: traveler.id } })).toBe(1);

    const tickets = await request(app).get('/api/v1/e-tickets').set(bearer(traveler.token));
    expect(tickets.status).toBe(200);
    expect(tickets.body.data).toHaveLength(1);

    // The ticket belongs to the traveler: anybody else gets 404, never 403 (no hint that it exists).
    const stranger = await createUser('TRAVELER', 'stranger@example.com');
    const ticketId = tickets.body.data[0].id;
    expect((await request(app).get(`/api/v1/e-tickets/${ticketId}`).set(bearer(traveler.token))).status).toBe(200);
    expect((await request(app).get(`/api/v1/e-tickets/${ticketId}`).set(bearer(stranger.token))).status).toBe(404);
    expect((await request(app).get(`/api/v1/e-tickets/booking/${bookingId}`).set(bearer(stranger.token))).status).toBe(404);
    expect((await request(app).get('/api/v1/e-tickets').set(bearer(stranger.token))).body.data).toHaveLength(0);

    // In-app notifications: the traveler was told, can mark them read, and nobody else can touch them.
    const inbox = await request(app).get('/api/v1/notifications').set(bearer(traveler.token));
    const types = inbox.body.data.map((n: { type: string }) => n.type);
    expect(types).toEqual(expect.arrayContaining(['BOOKING_CREATED', 'BOOKING_CONFIRMED', 'PAYMENT_SUCCEEDED']));
    const unread = await request(app).get('/api/v1/notifications/unread-count').set(bearer(traveler.token));
    expect(unread.body.data.unread).toBe(inbox.body.data.length);
    const first = inbox.body.data[0].id;
    expect((await request(app).patch(`/api/v1/notifications/${first}/read`).set(bearer(stranger.token))).status).toBe(404);
    expect((await request(app).patch(`/api/v1/notifications/${first}/read`).set(bearer(traveler.token))).status).toBe(200);
    expect((await request(app).post('/api/v1/notifications/read-all').set(bearer(stranger.token))).status).toBeLessThan(300);
    const after = await request(app).get('/api/v1/notifications/unread-count').set(bearer(traveler.token));
    expect(after.body.data.unread).toBe(inbox.body.data.length - 1); // the stranger's read-all did not touch ours
  });

  it('rejects an unsigned or tampered webhook without touching any state', async () => {
    const { traveler, bookingId } = await pendingBooking();
    await checkout(traveler.token, bookingId);
    const payment = (await prisma.payment.findFirst())!;

    const tampered = signedWebhook(Number(payment.providerOrderCode), payment.amount);
    tampered.data.amount = 1; // changed after signing
    expect((await webhook(tampered)).status).toBe(400);
    expect((await webhook({ ...signedWebhook(Number(payment.providerOrderCode), payment.amount), signature: 'f'.repeat(64) })).status).toBe(400);
    expect((await webhook({ data: { orderCode: Number(payment.providerOrderCode) } })).status).toBe(400);
    expect((await webhook(undefined)).status).toBe(400);

    expect((await prisma.payment.findUnique({ where: { id: payment.id } }))!.status).toBe('PENDING');
    expect((await prisma.booking.findUnique({ where: { id: bookingId } }))!.status).toBe('PENDING');
  });

  it('a correctly signed webhook with the wrong amount is flagged and never confirms the booking', async () => {
    const { traveler, bookingId } = await pendingBooking();
    await checkout(traveler.token, bookingId);
    const payment = (await prisma.payment.findFirst())!;

    expect((await webhook(signedWebhook(Number(payment.providerOrderCode), payment.amount - 1))).status).toBe(200);
    const after = (await prisma.payment.findUnique({ where: { id: payment.id } }))!;
    expect(after.status).toBe('PENDING');
    expect(after.failureReason).toBe('AMOUNT_MISMATCH');
    expect((await prisma.booking.findUnique({ where: { id: bookingId } }))!.status).toBe('PENDING');
  });

  it('unknown order codes and failed-payment events are acknowledged but ignored', async () => {
    const { traveler, bookingId } = await pendingBooking();
    await checkout(traveler.token, bookingId);
    const payment = (await prisma.payment.findFirst())!;

    expect((await webhook(signedWebhook(999_999_999, 1000))).status).toBe(200);
    expect((await webhook(signedWebhook(Number(payment.providerOrderCode), payment.amount, { success: false, code: '01' }))).status).toBe(200);
    expect((await prisma.payment.findUnique({ where: { id: payment.id } }))!.status).toBe('PENDING');
    expect((await prisma.booking.findUnique({ where: { id: bookingId } }))!.status).toBe('PENDING');
  });

  it('money for a booking that was cancelled meanwhile is kept and flagged for refund, seats stay released', async () => {
    const { traveler, tourId, bookingId } = await pendingBooking(3);
    await checkout(traveler.token, bookingId);
    const payment = (await prisma.payment.findFirst())!;
    expect((await request(app).post(`/api/v1/bookings/${bookingId}/cancel`).set(bearer(traveler.token)).send({})).status).toBe(200);

    expect((await webhook(signedWebhook(Number(payment.providerOrderCode), payment.amount))).status).toBe(200);

    const booking = (await prisma.booking.findUnique({ where: { id: bookingId } }))!;
    expect(booking.status).toBe('CANCELLED');
    expect(booking.refundRequired).toBe(true);
    expect(await prisma.eTicket.count()).toBe(0);
    expect((await loadTour(tourId))!.departures[0]!.remaining).toBe(10);
  });

  it('the retry job fulfils a PAID payment whose first fulfilment failed, exactly once', async () => {
    const { traveler, bookingId } = await pendingBooking();
    await checkout(traveler.token, bookingId);
    const payment = (await prisma.payment.findFirst())!;
    // Simulate "money received, but the process died before applying the business effect".
    await prisma.payment.updateMany({ where: { id: payment.id }, data: { status: 'PAID', paidAt: new Date() } });

    expect(await paymentsService.retryUnfulfilled()).toBe(1);
    expect(await paymentsService.retryUnfulfilled()).toBe(0);
    expect((await prisma.booking.findUnique({ where: { id: bookingId } }))!.status).toBe('CONFIRMED');
    expect(await prisma.eTicket.count({ where: { bookingId } })).toBe(1);
    expect(await prisma.notification.count({ where: { type: 'PAYMENT_SUCCEEDED' } })).toBe(1);
  });
});
