import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.PAYOS_CLIENT_ID = 'test-client';
  process.env.PAYOS_API_KEY = 'test-api-key';
  process.env.PAYOS_CHECKSUM_KEY = 'test-checksum-key';
});

import { createApp } from '../../../app';
import { PaymentModel } from '../../payments/payments.model';
import { subscriptionsService } from '..';
import { PlanModel, SubscriptionModel } from '../subscriptions.model';
import { bearer, createUser, resetDatabase, signedPayosWebhook, startDatabase, stopDatabase, stubPayosApi } from '../../../test/integration';

// Real Express app + real MongoDB; only the PayOS HTTP API is faked.
const app = createApp();

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(async () => {
  await resetDatabase();
  stubPayosApi();
});

const webhook = (body: unknown) => request(app).post('/api/v1/payments/webhooks/payos').send(body as object);
const plan = (overrides: object = {}) =>
  PlanModel.create({ code: 'PRO_30', name: 'Pro 30 days', price: 199_000, durationDays: 30, ...overrides });
const subscribe = (token: string, planId: string) => request(app).post('/api/v1/subscriptions').set(bearer(token)).send({ planId });

async function pay(paymentId: string) {
  const payment = (await PaymentModel.findById(paymentId))!;
  return webhook(signedPayosWebhook(payment.providerOrderCode, payment.amount));
}

describe('subscriptions (integration)', () => {
  it('lists plans publicly and only lets guides subscribe', async () => {
    await plan();
    await plan({ code: 'OLD', isActive: false });
    const list = await request(app).get('/api/v1/subscriptions/plans');
    expect(list.status).toBe(200);
    expect(list.body.data.map((p: { code: string }) => p.code)).toEqual(['PRO_30']);

    const created = await PlanModel.findOne({ code: 'PRO_30' });
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    expect((await subscribe(traveler.token, created!.id)).status).toBe(403);
    expect((await request(app).post('/api/v1/subscriptions').send({ planId: created!.id })).status).toBe(401);
  });

  it('subscribe -> webhook activates once; replays do not extend the period', async () => {
    const pro = await plan();
    const guide = await createUser('TOUR_GUIDE', 'guide@example.com');

    const res = await subscribe(guide.token, pro.id);
    expect(res.status).toBeLessThan(300);
    expect(res.body.data.subscription.status).toBe('PENDING_PAYMENT');
    const payment = (await PaymentModel.findOne())!;
    expect(payment.amount).toBe(199_000);
    expect((await request(app).get('/api/v1/subscriptions/me/current').set(bearer(guide.token))).body.data.active).toBe(false);

    const body = signedPayosWebhook(payment.providerOrderCode, payment.amount);
    const replays = await Promise.all(Array.from({ length: 6 }, () => webhook(body)));
    expect(replays.every((r) => r.status === 200)).toBe(true);

    const stored = await SubscriptionModel.find();
    expect(stored).toHaveLength(1);
    expect(stored[0]!.status).toBe('ACTIVE');
    const days = (stored[0]!.endsAt!.getTime() - stored[0]!.startsAt!.getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(30);

    const current = await request(app).get('/api/v1/subscriptions/me/current').set(bearer(guide.token));
    expect(current.body.data.active).toBe(true);
    expect(await subscriptionsService.hasActiveSubscription(guide.id)).toBe(true);
  });

  it('double click: parallel subscribe calls share ONE pending subscription and ONE payment', async () => {
    const pro = await plan();
    const guide = await createUser('TOUR_GUIDE', 'guide@example.com');

    const results = await Promise.all(Array.from({ length: 5 }, () => subscribe(guide.token, pro.id)));
    expect(results.every((r) => r.status < 300)).toBe(true);
    expect(await SubscriptionModel.countDocuments()).toBe(1);
    expect(await PaymentModel.countDocuments()).toBe(1);
  });

  it('renewals stack: a second paid plan starts when the first one ends', async () => {
    const pro = await plan();
    const guide = await createUser('TOUR_GUIDE', 'guide@example.com');

    await subscribe(guide.token, pro.id);
    await pay((await PaymentModel.findOne())!.id);
    const first = (await SubscriptionModel.findOne({ status: 'ACTIVE' }))!;

    await subscribe(guide.token, pro.id);
    const second = (await PaymentModel.find().sort({ createdAt: -1 }))[0]!;
    expect(String(second.referenceId)).not.toBe(first.id);
    await pay(second.id);

    const renewed = (await SubscriptionModel.findById(second.referenceId))!;
    expect(renewed.status).toBe('ACTIVE');
    expect(renewed.startsAt!.getTime()).toBe(first.endsAt!.getTime());
  });

  it('expiry job closes ended subscriptions, abandoned unpaid ones are cancelled but a late payment still activates', async () => {
    const pro = await plan();
    const guide = await createUser('TOUR_GUIDE', 'guide@example.com');

    await subscribe(guide.token, pro.id);
    const payment = (await PaymentModel.findOne())!;
    // Abandoned: created long ago and never paid.
    // createdAt is immutable in Mongoose, so go through the raw collection.
    await SubscriptionModel.collection.updateOne({}, { $set: { createdAt: new Date(Date.now() - 24 * 3_600_000) } });
    expect(await subscriptionsService.cancelAbandonedSubscriptions()).toBe(1);
    expect((await SubscriptionModel.findOne())!.status).toBe('CANCELLED');

    // The money arrives anyway.
    expect((await pay(payment.id)).status).toBe(200);
    expect((await SubscriptionModel.findOne())!.status).toBe('ACTIVE');

    // Period over -> EXPIRED, exactly once.
    await SubscriptionModel.updateOne({}, { $set: { endsAt: new Date(Date.now() - 1000) } });
    expect(await subscriptionsService.expireEndedSubscriptions()).toBe(1);
    expect(await subscriptionsService.expireEndedSubscriptions()).toBe(0);
    expect((await SubscriptionModel.findOne())!.status).toBe('EXPIRED');
    expect(await subscriptionsService.hasActiveSubscription(guide.id)).toBe(false);
  });

  it("a user cannot see or activate somebody else's subscription", async () => {
    const pro = await plan();
    const guide = await createUser('TOUR_GUIDE', 'guide@example.com');
    const other = await createUser('TOUR_GUIDE', 'other@example.com');
    await subscribe(guide.token, pro.id);

    const mine = await request(app).get('/api/v1/subscriptions/me').set(bearer(other.token));
    expect(mine.body.data).toHaveLength(0);
    const payment = (await PaymentModel.findOne())!;
    expect((await request(app).get(`/api/v1/payments/${payment.id}`).set(bearer(other.token))).status).toBe(404);
  });
});
