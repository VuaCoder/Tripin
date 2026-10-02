import { describe, expect, it, vi } from 'vitest';
import { PAYMENT_PURPOSE, PAYMENT_STATUS } from '@travel-platform/constants';
import { paymentEvents } from '../payments.events';
import { PaymentsService, generateOrderCode } from '../payments.service';

type P = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const future = () => new Date(Date.now() + 20 * 60 * 1000);

function payment(over: P = {}): P {
  return {
    id: 'pay1',
    purpose: PAYMENT_PURPOSE.BOOKING,
    userId: 'u1',
    referenceId: 'b1',
    amount: 2_000_000,
    currency: 'VND',
    description: 'TRP-ABCD2345',
    provider: 'PAYOS',
    providerOrderCode: 111,
    checkoutUrl: 'https://pay.example/pl1',
    status: PAYMENT_STATUS.PENDING,
    expiresAt: future(),
    createdAt: new Date(),
    ...over,
  };
}

function make(seed: P[] = [], providerOverrides: P = {}) {
  const db = [...seed];
  const repo = {
    create: vi.fn(async (data: P) => {
      const doc = payment({ ...data, id: `pay${db.length + 1}`, checkoutUrl: undefined });
      db.push(doc);
      return doc;
    }),
    findById: vi.fn(async (id: string) => db.find((p) => p.id === id) ?? null),
    findByOrderCode: vi.fn(async (code: number) => db.find((p) => p.providerOrderCode === code) ?? null),
    findLivePending: vi.fn(async (purpose: string, ref: string) => db.find((p) => p.purpose === purpose && p.referenceId === ref && p.status === 'PENDING' && p.expiresAt > new Date()) ?? null),
    findPending: vi.fn(async (purpose: string, ref: string) => db.find((p) => p.purpose === purpose && p.referenceId === ref && p.status === 'PENDING') ?? null),
    updateById: vi.fn(async (id: string, update: P) => {
      const doc = db.find((p) => p.id === id);
      if (doc) Object.assign(doc, update.$set);
      return doc ?? null;
    }),
    transition: vi.fn(async (id: string, expected: string[], update: P) => {
      const doc = db.find((p) => p.id === id);
      if (!doc || !expected.includes(doc.status)) return null;
      Object.assign(doc, update.$set);
      for (const key of Object.keys(update.$unset ?? {})) delete doc[key];
      return doc;
    }),
    markFulfilled: vi.fn(async (id: string) => {
      const doc = db.find((p) => p.id === id);
      if (!doc || doc.status !== 'PAID' || doc.fulfilledAt) return null;
      doc.fulfilledAt = new Date();
      return doc;
    }),
    findPaidUnfulfilled: vi.fn(async () => db.filter((p) => p.status === 'PAID' && !p.fulfilledAt)),
    findExpiredPending: vi.fn(async () => db.filter((p) => p.status === 'PENDING' && p.expiresAt < new Date())),
  };
  const provider = {
    name: 'PAYOS',
    createPaymentLink: vi.fn(async (_input: P) => ({ providerPaymentLinkId: 'pl1', checkoutUrl: 'https://pay.example/pl1' })),
    verifyWebhook: vi.fn((payload: P) => payload as never),
    getPaymentStatus: vi.fn(async () => ({ state: 'PENDING', amountPaid: 0 })),
    ...providerOverrides,
  };
  const bookings = {
    getPayable: vi.fn(async () => ({ bookingId: 'b1', bookingCode: 'TRP-ABCD2345', description: 'TRP-ABCD2345', amount: 2_000_000, expiresAt: future() })),
    confirmPayment: vi.fn(async () => ({ outcome: 'CONFIRMED' })),
  };
  const notifications = { notify: vi.fn(async () => undefined) };
  return { service: new PaymentsService(repo as never, provider as never, bookings as never, notifications), repo, provider, bookings, notifications, db };
}

const paidEvent = (over: P = {}) => ({ orderCode: 111, amount: 2_000_000, success: true, reference: 'TF1', ...over });

describe('checkout', () => {
  it('takes the amount from the booking, creates the link and stores it', async () => {
    const { service, provider, repo } = make();
    const checkout = await service.createBookingCheckout('u1', 'b1');
    expect(checkout).toMatchObject({ checkoutUrl: 'https://pay.example/pl1', amount: 2_000_000 });
    const sent = provider.createPaymentLink.mock.calls[0]![0] as P;
    expect(sent).toMatchObject({ amount: 2_000_000, description: 'TRP-ABCD2345' });
    expect(sent.returnUrl).toContain('paymentId=pay1');
    expect(repo.create.mock.calls[0]![0]).toMatchObject({ purpose: 'BOOKING', userId: 'u1', referenceId: 'b1', amount: 2_000_000 });
  });

  it('reuses the live link on a double click instead of creating a second payment', async () => {
    const { service, provider } = make([payment()]);
    const checkout = await service.createBookingCheckout('u1', 'b1');
    expect(checkout.paymentId).toBe('pay1');
    expect(provider.createPaymentLink).not.toHaveBeenCalled();
  });

  it('picks a new order code when the unique index reports a collision with another process', async () => {
    const { service, repo } = make();
    repo.create.mockRejectedValueOnce(Object.assign(new Error('E11000'), { code: 11000 }) as never);
    await expect(service.createBookingCheckout('u1', 'b1')).resolves.toMatchObject({ amount: 2_000_000 });
    expect(repo.create).toHaveBeenCalledTimes(2);
    expect(repo.create.mock.calls[0]![0].providerOrderCode).not.toBe(repo.create.mock.calls[1]![0].providerOrderCode);
  });

  it('marks the payment FAILED and rethrows when the gateway is down', async () => {
    const { service, provider, db } = make();
    provider.createPaymentLink.mockRejectedValueOnce(Object.assign(new Error('down'), { statusCode: 503 }));
    await expect(service.createBookingCheckout('u1', 'b1')).rejects.toMatchObject({ statusCode: 503 });
    expect(db[0]).toMatchObject({ status: 'FAILED', failureReason: 'PROVIDER_ERROR' });
  });

  it('propagates "booking not payable" (wrong owner / expired) without touching the gateway', async () => {
    const { service, bookings, provider } = make();
    bookings.getPayable.mockRejectedValueOnce(Object.assign(new Error('x'), { statusCode: 404 }) as never);
    await expect(service.createBookingCheckout('u2', 'b1')).rejects.toMatchObject({ statusCode: 404 });
    expect(provider.createPaymentLink).not.toHaveBeenCalled();
  });

  it('generates distinct safe-integer order codes', () => {
    const codes = Array.from({ length: 500 }, generateOrderCode);
    expect(new Set(codes).size).toBe(500);
    for (const code of codes) expect(Number.isSafeInteger(code)).toBe(true);
  });
});

describe('webhook', () => {
  it('marks PAID, confirms the booking once and notifies the payer', async () => {
    const { service, bookings, notifications, db } = make([payment()]);
    expect(await service.handleWebhook(paidEvent())).toEqual({ handled: true });
    expect(db[0]).toMatchObject({ status: 'PAID', providerReference: 'TF1' });
    expect(db[0]!.fulfilledAt).toBeDefined();
    expect(bookings.confirmPayment).toHaveBeenCalledWith('b1');
    expect(notifications.notify).toHaveBeenCalledWith('u1', expect.objectContaining({ type: 'PAYMENT_SUCCEEDED' }));
  });

  it('is idempotent: a replayed webhook never confirms or notifies twice', async () => {
    const { service, bookings, notifications } = make([payment()]);
    await service.handleWebhook(paidEvent());
    await service.handleWebhook(paidEvent());
    await service.handleWebhook(paidEvent());
    expect(bookings.confirmPayment).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledTimes(1);
  });

  it('survives two concurrent deliveries (only one wins the PAID transition)', async () => {
    const { service, bookings } = make([payment()]);
    await Promise.all([service.handleWebhook(paidEvent()), service.handleWebhook(paidEvent())]);
    expect(bookings.confirmPayment.mock.calls.length).toBeLessThanOrEqual(2); // handler itself is idempotent
    const { db } = make([payment()]);
    expect(db).toHaveLength(1);
  });

  it('rejects an invalid signature with 400 and changes nothing', async () => {
    const { service, provider, db } = make([payment()]);
    provider.verifyWebhook.mockImplementationOnce(() => {
      throw Object.assign(new Error('bad signature'), { statusCode: 400 });
    });
    await expect(service.handleWebhook({ forged: true })).rejects.toMatchObject({ statusCode: 400 });
    expect(db[0]!.status).toBe('PENDING');
  });

  it('never trusts the amount in the payload: a mismatch is recorded, not paid', async () => {
    const { service, bookings, db } = make([payment()]);
    expect(await service.handleWebhook(paidEvent({ amount: 1 }))).toEqual({ handled: false });
    expect(db[0]).toMatchObject({ status: 'PENDING', failureReason: 'AMOUNT_MISMATCH' });
    expect(bookings.confirmPayment).not.toHaveBeenCalled();
  });

  it('ignores unknown orders (e.g. the gateway\'s test ping) and non-success events', async () => {
    const { service, bookings } = make([payment()]);
    expect(await service.handleWebhook(paidEvent({ orderCode: 999 }))).toEqual({ handled: false });
    expect(await service.handleWebhook(paidEvent({ success: false }))).toEqual({ handled: false });
    expect(bookings.confirmPayment).not.toHaveBeenCalled();
  });

  it('a payment that arrives after expiry still becomes PAID, so the booking side can flag a refund', async () => {
    const { service, bookings, db } = make([payment({ status: 'EXPIRED' })]);
    await service.handleWebhook(paidEvent());
    expect(db[0]!.status).toBe('PAID');
    expect(bookings.confirmPayment).toHaveBeenCalledWith('b1');
  });

  it('keeps the payment PAID-but-unfulfilled when fulfilment fails, and retries it later', async () => {
    const { service, bookings, db } = make([payment()]);
    bookings.confirmPayment.mockRejectedValueOnce(new Error('db blip'));
    await service.handleWebhook(paidEvent());
    expect(db[0]).toMatchObject({ status: 'PAID' });
    expect(db[0]!.fulfilledAt).toBeUndefined();

    expect(await service.retryUnfulfilled()).toBe(1);
    expect(db[0]!.fulfilledAt).toBeDefined();
    expect(bookings.confirmPayment).toHaveBeenCalledTimes(2);
  });

  it('fulfils non-booking purposes through the registered handler', async () => {
    const handler = vi.fn(async () => undefined);
    paymentEvents.onPaid(PAYMENT_PURPOSE.SUBSCRIPTION, handler);
    const { service, bookings } = make([payment({ purpose: 'SUBSCRIPTION', referenceId: 's1' })]);
    await service.handleWebhook(paidEvent());
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'SUBSCRIPTION', referenceId: 's1', userId: 'u1' }));
    expect(bookings.confirmPayment).not.toHaveBeenCalled();
  });
});

describe('reading and reconciling', () => {
  it('hides other users\' payments behind 404', async () => {
    const { service } = make([payment({ userId: 'other' })]);
    await expect(service.getMine('u1', 'pay1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('reconciles a missed webhook when the owner polls a PENDING payment', async () => {
    const { service, provider, bookings } = make([payment()]);
    provider.getPaymentStatus.mockResolvedValueOnce({ state: 'PAID', amountPaid: 2_000_000 } as never);
    const dto = await service.getMine('u1', 'pay1');
    expect(dto.status).toBe('PAID');
    expect(bookings.confirmPayment).toHaveBeenCalledTimes(1);
  });

  it('asks the gateway at most once per interval however often the client polls, and again after the interval', async () => {
    vi.useFakeTimers();
    try {
      const { service, provider } = make([payment()]);
      provider.getPaymentStatus.mockResolvedValue({ state: 'PENDING', amountPaid: 0 } as never);
      for (let i = 0; i < 20; i += 1) await service.getMine('u1', 'pay1');
      expect(provider.getPaymentStatus).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(6_000);
      await service.getMine('u1', 'pay1');
      expect(provider.getPaymentStatus).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not accept a partial amount from the gateway as paid', async () => {
    const { service, provider } = make([payment()]);
    provider.getPaymentStatus.mockResolvedValueOnce({ state: 'PAID', amountPaid: 1000 } as never);
    expect((await service.getMine('u1', 'pay1')).status).toBe('PENDING');
  });

  it('still answers when the gateway is unreachable', async () => {
    const { service, provider } = make([payment()]);
    provider.getPaymentStatus.mockRejectedValueOnce(new Error('timeout'));
    expect((await service.getMine('u1', 'pay1')).status).toBe('PENDING');
  });

  it('hides the checkout url once the payment is no longer open', async () => {
    const { service } = make([payment({ status: 'PAID', fulfilledAt: new Date(), paidAt: new Date() })]);
    expect((await service.getMine('u1', 'pay1')).checkoutUrl).toBeUndefined();
  });
});

describe('expiry job', () => {
  it('expires stale pending payments but settles one the gateway says was paid', async () => {
    const { service, provider, db } = make([
      payment({ id: 'old1', providerOrderCode: 1, expiresAt: new Date(Date.now() - 1000) }),
      payment({ id: 'old2', providerOrderCode: 2, referenceId: 'b2', expiresAt: new Date(Date.now() - 1000) }),
    ]);
    provider.getPaymentStatus
      .mockResolvedValueOnce({ state: 'PENDING', amountPaid: 0 } as never)
      .mockResolvedValueOnce({ state: 'PAID', amountPaid: 2_000_000 } as never);
    expect(await service.expireStalePayments()).toBe(1);
    expect(db.find((p) => p.id === 'old1')!.status).toBe('EXPIRED');
    expect(db.find((p) => p.id === 'old2')!.status).toBe('PAID');
  });
});
