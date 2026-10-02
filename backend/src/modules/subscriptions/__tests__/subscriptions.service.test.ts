import { describe, expect, it, vi } from 'vitest';
import { PAYMENT_PURPOSE } from '@travel-platform/constants';
import { SubscriptionsService } from '../subscriptions.service';

type S = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const DAY = 24 * 60 * 60 * 1000;
const plan = (over: S = {}) => ({ id: 'p1', code: 'GUIDE_MONTHLY', name: 'Monthly', price: 199_000, durationDays: 30, isActive: true, benefits: [], ...over });

function sub(over: S = {}): S {
  return {
    id: 's1',
    userId: 'g1',
    planId: 'p1',
    planCode: 'GUIDE_MONTHLY',
    planName: 'Monthly',
    price: 199_000,
    durationDays: 30,
    status: 'PENDING_PAYMENT',
    createdAt: new Date(),
    ...over,
  };
}

function make(opts: { plan?: S | null; seed?: S[] } = {}) {
  const db = [...(opts.seed ?? [])];
  const repo = {
    listActivePlans: vi.fn(async () => [plan()]),
    findPlanById: vi.fn(async () => (opts.plan === undefined ? plan() : opts.plan)),
    create: vi.fn(async (data: S) => {
      const doc = sub({ ...data, id: `s${db.length + 1}` });
      db.push(doc);
      return doc;
    }),
    findById: vi.fn(async (id: string) => db.find((s) => s.id === id) ?? null),
    findPending: vi.fn(async (userId: string, planId: string) => db.find((s) => s.userId === userId && String(s.planId) === planId && s.status === 'PENDING_PAYMENT') ?? null),
    findCurrentActive: vi.fn(async (userId: string, now: Date) => db.filter((s) => s.userId === userId && s.status === 'ACTIVE' && s.endsAt > now).sort((a, b) => b.endsAt - a.endsAt)[0] ?? null),
    transition: vi.fn(async (id: string, expected: string[], update: S) => {
      const doc = db.find((s) => s.id === id);
      if (!doc || !expected.includes(doc.status)) return null;
      Object.assign(doc, update);
      return doc;
    }),
    listByUser: vi.fn(async () => ({ items: db, total: db.length })),
    findEnded: vi.fn(async (now: Date) => db.filter((s) => s.status === 'ACTIVE' && s.endsAt <= now)),
    findAbandoned: vi.fn(async (before: Date) => db.filter((s) => s.status === 'PENDING_PAYMENT' && s.createdAt < before)),
  };
  const payments = { createCheckout: vi.fn(async (input: S) => ({ paymentId: 'pay1', checkoutUrl: 'https://pay/x', amount: input.amount, expiresAt: input.expiresAt.toISOString() })) };
  const notifications = { notify: vi.fn(async () => undefined) };
  return { service: new SubscriptionsService(repo as never, payments as never, notifications), repo, payments, notifications, db };
}

const paid = (over: S = {}) => ({ id: 'pay1', purpose: PAYMENT_PURPOSE.SUBSCRIPTION, userId: 'g1', referenceId: 's1', amount: 199_000, ...over });

describe('subscribe', () => {
  it('creates a PENDING_PAYMENT subscription from the plan and opens a SUBSCRIPTION checkout for the plan price', async () => {
    const { service, repo, payments } = make();
    const result = await service.subscribe('g1', 'p1');
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'g1', planCode: 'GUIDE_MONTHLY', price: 199_000, durationDays: 30 }));
    expect(payments.createCheckout).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'SUBSCRIPTION', userId: 'g1', referenceId: 's1', amount: 199_000 }));
    expect(result.subscription.status).toBe('PENDING_PAYMENT');
    expect(result.checkout.checkoutUrl).toBe('https://pay/x');
  });

  it('reuses the unpaid subscription when the guide presses subscribe again', async () => {
    const { service, repo } = make({ seed: [sub()] });
    await service.subscribe('g1', 'p1');
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('404 for unknown or retired plans', async () => {
    await expect(make({ plan: null }).service.subscribe('g1', 'p1')).rejects.toMatchObject({ statusCode: 404 });
    await expect(make({ plan: plan({ isActive: false }) }).service.subscribe('g1', 'p1')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('activateFromPayment', () => {
  it('activates for the plan duration, notifies by app and email, and is idempotent', async () => {
    const { service, db, notifications } = make({ seed: [sub()] });
    await service.activateFromPayment(paid());
    expect(db[0]).toMatchObject({ status: 'ACTIVE' });
    expect(db[0]!.endsAt.getTime() - db[0]!.startsAt.getTime()).toBe(30 * DAY);
    expect(notifications.notify).toHaveBeenCalledWith('g1', expect.objectContaining({ type: 'SUBSCRIPTION_ACTIVATED' }), { email: true });

    await service.activateFromPayment(paid());
    expect(notifications.notify).toHaveBeenCalledTimes(1);
  });

  it('stacks a renewal after the running period instead of overlapping it', async () => {
    const runningEnd = new Date(Date.now() + 10 * DAY);
    const { service, db } = make({ seed: [sub({ id: 'old', status: 'ACTIVE', startsAt: new Date(Date.now() - 20 * DAY), endsAt: runningEnd }), sub({ id: 's2' })] });
    await service.activateFromPayment(paid({ referenceId: 's2' }));
    const renewal = db.find((s) => s.id === 's2')!;
    expect(renewal.startsAt.getTime()).toBe(runningEnd.getTime());
    expect(renewal.endsAt.getTime()).toBe(runningEnd.getTime() + 30 * DAY);
  });

  it('money received wins: a cancelled subscription is still activated by a late payment', async () => {
    const { service, db } = make({ seed: [sub({ status: 'CANCELLED' })] });
    await service.activateFromPayment(paid());
    expect(db[0]!.status).toBe('ACTIVE');
  });

  it('fails loudly (so the payment is retried) when the subscription cannot be found or belongs to someone else', async () => {
    await expect(make().service.activateFromPayment(paid())).rejects.toThrow(/not found/);
    await expect(make({ seed: [sub({ userId: 'other' })] }).service.activateFromPayment(paid())).rejects.toThrow(/not found/);
  });
});

describe('current subscription and jobs', () => {
  it('reports the running subscription and hasActiveSubscription', async () => {
    const { service } = make({ seed: [sub({ status: 'ACTIVE', startsAt: new Date(), endsAt: new Date(Date.now() + DAY) })] });
    expect(await service.getCurrent('g1')).toMatchObject({ active: true, subscription: { status: 'ACTIVE' } });
    expect(await service.hasActiveSubscription('g1')).toBe(true);
    expect(await service.hasActiveSubscription('nobody')).toBe(false);
    expect(await make().service.getCurrent('g1')).toEqual({ active: false, subscription: null });
  });

  it('expires ended periods', async () => {
    const { service, db } = make({ seed: [sub({ status: 'ACTIVE', endsAt: new Date(Date.now() - 1000) }), sub({ id: 's2', status: 'ACTIVE', endsAt: new Date(Date.now() + DAY) })] });
    expect(await service.expireEndedSubscriptions()).toBe(1);
    expect(db[0]!.status).toBe('EXPIRED');
    expect(db[1]!.status).toBe('ACTIVE');
  });

  it('cancels abandoned unpaid subscriptions only after the payment window is long over', async () => {
    const { service, db } = make({ seed: [sub({ createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) }), sub({ id: 's2', createdAt: new Date() })] });
    expect(await service.cancelAbandonedSubscriptions()).toBe(1);
    expect(db[0]!.status).toBe('CANCELLED');
    expect(db[1]!.status).toBe('PENDING_PAYMENT');
  });
});
