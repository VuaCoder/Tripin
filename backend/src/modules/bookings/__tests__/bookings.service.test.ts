import { describe, expect, it, vi } from 'vitest';
import { BOOKING_CANCEL_REASON, BOOKING_STATUS } from '@travel-platform/constants';
import { bookingEvents } from '../bookings.events';
import { BookingsService, generateBookingCode } from '../bookings.service';
import { BOOKING_POLICY } from '../bookings.policy';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

type B = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function booking(over: B = {}): B {
  return {
    id: 'b1',
    bookingCode: 'TRP-ABCD2345',
    travelerId: 'u1',
    agencyId: 'a1',
    tourId: 't1',
    departureId: 'd1',
    tourTitle: 'Ha Long',
    departureDate: new Date(Date.now() + 10 * DAY),
    endDate: new Date(Date.now() + 13 * DAY),
    participants: 2,
    contact: { fullName: 'Ann', phone: '0123456' },
    unitPrice: 1_000_000,
    subtotal: 2_000_000,
    discountAmount: 0,
    totalAmount: 2_000_000,
    commissionBps: 1000,
    commissionAmount: 200_000,
    agencyAmount: 1_800_000,
    status: BOOKING_STATUS.PENDING,
    isPaid: false,
    refundRequired: false,
    paymentExpiresAt: new Date(Date.now() + 20 * 60 * 1000),
    createdAt: new Date(),
    ...over,
  };
}

const departure = (over: B = {}) => ({
  tourId: 't1',
  agencyId: 'a1',
  title: 'Ha Long',
  durationDays: 3,
  departureId: 'd1',
  departureDate: new Date(Date.now() + 10 * DAY),
  unitPrice: 1_000_000,
  remaining: 10,
  ...over,
});

function make(seed: B[] = [], opts: { commissionBps?: number; windowHours?: number | undefined } = {}) {
  const db = [...seed];
  const repo = {
    create: vi.fn(async (data: B) => {
      const doc = booking({ ...data, id: `b${db.length + 1}` });
      db.push(doc);
      return doc;
    }),
    findById: vi.fn(async (id: string) => db.find((b) => b.id === id) ?? null),
    findByRequestId: vi.fn(async (travelerId: string, key: string) => db.find((b) => b.travelerId === travelerId && b.clientRequestId === key) ?? null),
    transition: vi.fn(async (id: string, expected: string[], update: B) => {
      const doc = db.find((b) => b.id === id);
      if (!doc || !expected.includes(doc.status)) return null;
      Object.assign(doc, update);
      return doc;
    }),
    updateById: vi.fn(async (id: string, update: B) => {
      const doc = db.find((b) => b.id === id);
      if (doc) Object.assign(doc, update);
      return doc ?? null;
    }),
    listByTraveler: vi.fn(async () => ({ items: db, total: db.length })),
    listByAgency: vi.fn(async () => ({ items: db, total: db.length })),
    findExpiredPending: vi.fn(async () => db.filter((b) => b.status === 'PENDING' && b.paymentExpiresAt < new Date())),
    findDueForCompletion: vi.fn(async () => db.filter((b) => b.status === 'CONFIRMED' && b.endDate < new Date())),
  };
  const tours = {
    getBookableDeparture: vi.fn(async () => departure()),
    reserveSeats: vi.fn(async () => undefined),
    releaseSeats: vi.fn(async () => undefined),
  };
  const promotions = {
    redeem: vi.fn(async () => ({ promotionId: 'p1', code: 'SUMMER10', scope: 'AGENCY', discountAmount: 200_000 })),
    release: vi.fn(async () => undefined),
  };
  const settings = {
    getCommissionBps: vi.fn(async () => opts.commissionBps ?? 1000),
    getPolicyNumber: vi.fn(async () => ('windowHours' in opts ? opts.windowHours : 24)),
  };
  const notifications = { notify: vi.fn(async () => undefined) };
  return { service: new BookingsService(repo as never, tours as never, promotions as never, settings as never, notifications), repo, tours, promotions, settings, notifications, db };
}

const input = {
  tourId: 't1',
  departureId: 'd1',
  participants: 2,
  contact: { fullName: 'Ann', phone: '0123456' },
};

describe('createBooking', () => {
  it('prices on the server, reserves seats atomically and snapshots commission', async () => {
    const { service, tours, repo } = make();
    const dto = await service.createBooking('u1', { ...input, participants: 3 });
    expect(tours.reserveSeats).toHaveBeenCalledWith('t1', 'd1', 3);
    const stored = repo.create.mock.calls[0]![0];
    expect(stored).toMatchObject({ subtotal: 3_000_000, totalAmount: 3_000_000, commissionBps: 1000, commissionAmount: 300_000, agencyAmount: 2_700_000, status: 'PENDING' });
    expect(stored.bookingCode).toMatch(/^TRP-[A-Z2-9]{8}$/);
    expect(dto.status).toBe('PENDING');
    expect(dto).not.toHaveProperty('commissionAmount');
  });

  it('applies a promotion and subtracts it from the total', async () => {
    const { service, repo, promotions } = make();
    await service.createBooking('u1', { ...input, promotionCode: 'SUMMER10' });
    expect(promotions.redeem).toHaveBeenCalledWith('SUMMER10', 't1', 2_000_000);
    expect(repo.create.mock.calls[0]![0]).toMatchObject({ discountAmount: 200_000, totalAmount: 1_800_000, commissionAmount: 180_000, agencyAmount: 1_620_000 });
  });

  it('refuses more participants than free seats before touching inventory', async () => {
    const { service, tours } = make();
    tours.getBookableDeparture.mockResolvedValueOnce(departure({ remaining: 1 }) as never);
    await expect(service.createBooking('u1', input)).rejects.toMatchObject({ code: 'NOT_ENOUGH_SEATS' });
    expect(tours.reserveSeats).not.toHaveBeenCalled();
  });

  it('gives seats back if the promotion code is rejected', async () => {
    const { service, tours, promotions } = make();
    promotions.redeem.mockRejectedValueOnce(Object.assign(new Error('expired'), { code: 'PROMOTION_EXPIRED' }) as never);
    await expect(service.createBooking('u1', { ...input, promotionCode: 'OLD' })).rejects.toMatchObject({ code: 'PROMOTION_EXPIRED' });
    expect(tours.releaseSeats).toHaveBeenCalledWith('t1', 'd1', 2);
  });

  it('gives seats AND the promotion back if saving fails', async () => {
    const { service, tours, promotions, repo } = make();
    repo.create.mockRejectedValueOnce(new Error('db down'));
    await expect(service.createBooking('u1', { ...input, promotionCode: 'SUMMER10' })).rejects.toThrow('db down');
    expect(tours.releaseSeats).toHaveBeenCalledOnce();
    expect(promotions.release).toHaveBeenCalledWith('p1');
  });

  it('is idempotent with clientRequestId: the retry returns the first booking and reserves nothing', async () => {
    const { service, tours } = make([booking({ clientRequestId: 'req-12345678' })]);
    const dto = await service.createBooking('u1', { ...input, clientRequestId: 'req-12345678' });
    expect(dto.id).toBe('b1');
    expect(tours.reserveSeats).not.toHaveBeenCalled();
  });

  it('retries on a booking-code collision', async () => {
    const { service, repo } = make();
    repo.create.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'P2002', meta: { target: ['bookingCode'] } }) as never);
    await expect(service.createBooking('u1', input)).resolves.toMatchObject({ status: 'PENDING' });
    expect(repo.create).toHaveBeenCalledTimes(2);
  });

  it('generates readable codes', () => {
    const codes = new Set(Array.from({ length: 200 }, generateBookingCode));
    expect(codes.size).toBe(200);
    for (const code of codes) expect(code).toMatch(new RegExp(`^TRP-[${BOOKING_POLICY.CODE_ALPHABET}]{8}$`));
  });
});

describe('ownership', () => {
  it('hides other travelers\' bookings behind 404', async () => {
    const { service } = make([booking({ travelerId: 'someone-else' })]);
    await expect(service.getMine('u1', 'b1')).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.cancelMine('u1', 'b1')).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.getPayable('u1', 'b1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('shows an agency only bookings of its own tours, and hides traveler contact until confirmed', async () => {
    const { service } = make([booking({ id: 'b1' }), booking({ id: 'b2', status: 'CONFIRMED' }), booking({ id: 'b3', agencyId: 'a2' })]);
    expect((await service.getForAgency('a1', 'b1')).traveler).toBeUndefined();
    expect((await service.getForAgency('a1', 'b2')).traveler).toEqual({ fullName: 'Ann', phone: '0123456' });
    await expect(service.getForAgency('a1', 'b3')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('cancelMine', () => {
  it('cancels a PENDING booking, releases seats and the promotion, and tells the agency', async () => {
    const promotion = { promotionId: 'p1', code: 'X', scope: 'AGENCY', discountAmount: 1 };
    const { service, tours, promotions, notifications, db } = make([booking({ promotion })]);
    const dto = await service.cancelMine('u1', 'b1', 'changed my mind');
    expect(dto.status).toBe('CANCELLED');
    expect(db[0]!.cancelReason).toBe(BOOKING_CANCEL_REASON.TRAVELER_REQUEST);
    expect(tours.releaseSeats).toHaveBeenCalledWith('t1', 'd1', 2);
    expect(promotions.release).toHaveBeenCalledWith('p1');
    expect(notifications.notify).toHaveBeenCalledWith('a1', expect.objectContaining({ type: 'BOOKING_CANCELLED' }));
  });

  it('emits the cancelled event so e-tickets can be invalidated', async () => {
    const handler = vi.fn();
    bookingEvents.onCancelled(handler);
    const { service } = make([booking()]);
    await service.cancelMine('u1', 'b1');
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: 'b1', status: 'CANCELLED', contactName: 'Ann' }));
  });

  it('lets a CONFIRMED booking be cancelled outside the window and flags the refund', async () => {
    const { service, db } = make([booking({ status: 'CONFIRMED', isPaid: true })]);
    await service.cancelMine('u1', 'b1');
    expect(db[0]).toMatchObject({ status: 'CANCELLED', refundRequired: true });
  });

  it('refuses a CONFIRMED booking inside the cancellation window', async () => {
    const { service, tours } = make([booking({ status: 'CONFIRMED', isPaid: true, departureDate: new Date(Date.now() + 5 * HOUR) })]);
    await expect(service.cancelMine('u1', 'b1')).rejects.toMatchObject({ code: 'CANCELLATION_WINDOW_PASSED' });
    expect(tours.releaseSeats).not.toHaveBeenCalled();
  });

  it('falls back to 24 hours when the policy has no window', async () => {
    const { service } = make([booking({ status: 'CONFIRMED', departureDate: new Date(Date.now() + 5 * HOUR) })], { windowHours: undefined });
    await expect(service.cancelMine('u1', 'b1')).rejects.toMatchObject({ code: 'CANCELLATION_WINDOW_PASSED' });
  });

  it.each(['COMPLETED', 'CANCELLED'])('refuses to cancel a %s booking', async (status) => {
    const { service } = make([booking({ status })]);
    await expect(service.cancelMine('u1', 'b1')).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
  });

  it('cannot cancel twice (second attempt is an invalid transition, seats released once)', async () => {
    const { service, tours } = make([booking()]);
    await service.cancelMine('u1', 'b1');
    await expect(service.cancelMine('u1', 'b1')).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
    expect(tours.releaseSeats).toHaveBeenCalledTimes(1);
  });
});

describe('payment hooks', () => {
  it('getPayable returns the server-side amount only for a live PENDING booking', async () => {
    const { service } = make([booking()]);
    expect(await service.getPayable('u1', 'b1')).toMatchObject({ bookingId: 'b1', amount: 2_000_000 });
    const expired = make([booking({ paymentExpiresAt: new Date(Date.now() - 1000) })]);
    await expect(expired.service.getPayable('u1', 'b1')).rejects.toMatchObject({ code: 'BOOKING_PAYMENT_EXPIRED' });
    const confirmed = make([booking({ status: 'CONFIRMED' })]);
    await expect(confirmed.service.getPayable('u1', 'b1')).rejects.toMatchObject({ code: 'BOOKING_NOT_PAYABLE' });
  });

  it('confirmPayment confirms once, notifies both sides, emits the event and is idempotent', async () => {
    const handler = vi.fn();
    bookingEvents.onConfirmed(handler);
    const { service, notifications, db } = make([booking()]);
    expect((await service.confirmPayment('b1')).outcome).toBe('CONFIRMED');
    expect(db[0]).toMatchObject({ status: 'CONFIRMED', isPaid: true });
    expect(db[0]!.paymentExpiresAt).toBeNull();
    expect(notifications.notify).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenCalledTimes(1);

    expect((await service.confirmPayment('b1')).outcome).toBe('ALREADY_CONFIRMED');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('a payment that arrives after cancellation never revives the booking: refund required', async () => {
    const { service, db } = make([booking({ status: 'CANCELLED', cancelReason: BOOKING_CANCEL_REASON.PAYMENT_EXPIRED })]);
    expect((await service.confirmPayment('b1')).outcome).toBe('REFUND_REQUIRED');
    expect(db[0]).toMatchObject({ status: 'CANCELLED', isPaid: true, refundRequired: true });
  });

  it('404 for an unknown booking', async () => {
    await expect(make().service.confirmPayment('nope')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('maintenance', () => {
  it('expires unpaid bookings: cancels, releases seats, notifies the traveler', async () => {
    const { service, tours, notifications, db } = make([booking({ paymentExpiresAt: new Date(Date.now() - 1000) }), booking({ id: 'b2' })]);
    expect(await service.expirePendingBookings()).toBe(1);
    expect(db[0]).toMatchObject({ status: 'CANCELLED', cancelReason: 'PAYMENT_EXPIRED' });
    expect(db[1]!.status).toBe('PENDING');
    expect(tours.releaseSeats).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith('u1', expect.objectContaining({ type: 'BOOKING_CANCELLED' }));
  });

  it('never expires a booking that was paid a moment ago (stale PENDING snapshot, CONFIRMED in the database)', async () => {
    const { service, repo, tours, db } = make([booking({ status: 'CONFIRMED', isPaid: true, paymentExpiresAt: new Date(Date.now() - 1000) })]);
    repo.findExpiredPending.mockResolvedValueOnce([{ ...db[0], status: 'PENDING' }] as never);
    expect(await service.expirePendingBookings()).toBe(0);
    expect(db[0]!.status).toBe('CONFIRMED');
    expect(tours.releaseSeats).not.toHaveBeenCalled();
  });

  it('completes finished trips and emits the completed event once per booking', async () => {
    const handler = vi.fn();
    bookingEvents.onCompleted(handler);
    const { service, db } = make([booking({ status: 'CONFIRMED', endDate: new Date(Date.now() - DAY) }), booking({ id: 'b2', status: 'CONFIRMED' })]);
    expect(await service.completeFinishedBookings()).toBe(1);
    expect(db[0]!.status).toBe('COMPLETED');
    expect(db[1]!.status).toBe('CONFIRMED');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(await service.completeFinishedBookings()).toBe(0);
  });

  it('a failing event handler never blocks completion', async () => {
    bookingEvents.onCompleted(() => {
      throw new Error('handler bug');
    });
    const { service, db } = make([booking({ status: 'CONFIRMED', endDate: new Date(Date.now() - DAY) })]);
    await expect(service.completeFinishedBookings()).resolves.toBe(1);
    expect(db[0]!.status).toBe('COMPLETED');
  });
});
