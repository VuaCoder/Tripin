import { describe, expect, it, vi } from 'vitest';
import { ETicketsService, generateTicketCode } from '../e-tickets.service';
import { ETICKET_POLICY } from '../e-tickets.types';

type T = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const booking = {
  id: 'b1',
  bookingCode: 'TRP-ABCD2345',
  status: 'CONFIRMED',
  travelerId: 'u1',
  agencyId: 'a1',
  tourId: 't1',
  tourTitle: 'Ha Long 3D2N',
  departureId: 'd1',
  departureDate: new Date('2026-12-01T00:00:00Z'),
  participants: 2,
  contactName: 'Ann Nguyen',
  totalAmount: 2_000_000,
  commissionAmount: 200_000,
  agencyAmount: 1_800_000,
} as const;

function make(seed: T[] = []) {
  const db = [...seed];
  const repo = {
    create: vi.fn(async (data: T) => {
      const doc = { id: `e${db.length + 1}`, status: 'VALID', ...data };
      db.push(doc);
      return doc;
    }),
    findById: vi.fn(async (id: string) => db.find((t) => t.id === id) ?? null),
    findByBookingId: vi.fn(async (bookingId: string) => db.find((t) => String(t.bookingId) === bookingId) ?? null),
    transitionByBooking: vi.fn(async (bookingId: string, expected: string, next: string) => {
      const doc = db.find((t) => String(t.bookingId) === bookingId);
      if (!doc || doc.status !== expected) return null;
      doc.status = next;
      return doc;
    }),
    listByTraveler: vi.fn(async () => ({ items: db, total: db.length })),
  };
  const notifications = { notify: vi.fn(async () => undefined) };
  return { service: new ETicketsService(repo as never, notifications), repo, notifications, db };
}

const stored = (over: T = {}) => ({
  id: 'e1',
  bookingId: 'b1',
  bookingCode: 'TRP-ABCD2345',
  code: 'ETK-AAAAAAAAAAAAAAAA',
  travelerId: 'u1',
  agencyId: 'a1',
  tourId: 't1',
  tourTitle: 'Ha Long',
  departureDate: new Date('2026-12-01'),
  participants: 2,
  holderName: 'Ann',
  status: 'VALID',
  issuedAt: new Date(),
  ...over,
});

describe('issueForBooking', () => {
  it('issues one ticket with an unguessable code and tells the traveler by app and email', async () => {
    const { service, repo, notifications } = make();
    const dto = await service.issueForBooking(booking);
    expect(dto).toMatchObject({ status: 'VALID', holderName: 'Ann Nguyen', booking: { code: 'TRP-ABCD2345' }, participants: 2 });
    expect(dto.code).toMatch(new RegExp(`^ETK-[${ETICKET_POLICY.CODE_ALPHABET}]{16}$`));
    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith('u1', expect.objectContaining({ type: 'ETICKET_ISSUED' }), { email: true });
  });

  it('is idempotent: a repeated event returns the same ticket and sends nothing again', async () => {
    const { service, repo, notifications } = make();
    const first = await service.issueForBooking(booking);
    const second = await service.issueForBooking(booking);
    expect(second.id).toBe(first.id);
    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledTimes(1);
  });

  it('handles two events racing: the loser returns the winner\'s ticket without notifying', async () => {
    const { service, repo, notifications } = make();
    const winner = stored();
    repo.findByBookingId.mockResolvedValueOnce(null as never).mockResolvedValue(winner as never);
    repo.create.mockRejectedValueOnce(Object.assign(new Error('E11000'), { code: 11000, keyPattern: { bookingId: 1 } }) as never);
    const dto = await service.issueForBooking(booking);
    expect(dto.id).toBe('e1');
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('retries a ticket-code collision with a new code', async () => {
    const { service, repo } = make();
    repo.create.mockRejectedValueOnce(Object.assign(new Error('E11000'), { code: 11000, keyPattern: { code: 1 } }) as never);
    await expect(service.issueForBooking(booking)).resolves.toMatchObject({ status: 'VALID' });
    expect(repo.create).toHaveBeenCalledTimes(2);
  });

  it('generates distinct codes', () => {
    expect(new Set(Array.from({ length: 300 }, generateTicketCode)).size).toBe(300);
  });
});

describe('lifecycle', () => {
  it('invalidates the ticket when the booking is cancelled, and only once', async () => {
    const { service, db } = make([stored()]);
    await service.cancelForBooking('b1');
    expect(db[0]!.status).toBe('CANCELLED');
    await expect(service.cancelForBooking('b1')).resolves.toBeUndefined();
    await expect(service.cancelForBooking('unknown')).resolves.toBeUndefined();
  });

  it('marks it used when the trip is completed, but never revives a cancelled ticket', async () => {
    const used = make([stored()]);
    await used.service.markUsedForBooking('b1');
    expect(used.db[0]!.status).toBe('USED');
    const cancelled = make([stored({ status: 'CANCELLED' })]);
    await cancelled.service.markUsedForBooking('b1');
    expect(cancelled.db[0]!.status).toBe('CANCELLED');
  });
});

describe('traveler access', () => {
  it('returns own tickets and hides foreign ones behind 404', async () => {
    const { service } = make([stored(), stored({ id: 'e2', bookingId: 'b2', travelerId: 'someone-else' })]);
    expect((await service.getMine('u1', 'e1')).id).toBe('e1');
    await expect(service.getMine('u1', 'e2')).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.getMineByBooking('u1', 'b2')).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.getMine('u1', 'nope')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('lists with pagination meta', async () => {
    const { service } = make([stored()]);
    const page = await service.listMine('u1', { page: 1, limit: 20 });
    expect(page.items).toHaveLength(1);
    expect(page.meta.total).toBe(1);
  });
});
