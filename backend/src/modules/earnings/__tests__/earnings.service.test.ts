import { describe, expect, it, vi } from 'vitest';
import { EarningsService } from '../earnings.service';

type E = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const booking = {
  id: 'b1',
  bookingCode: 'TRP-AAAA2222',
  status: 'COMPLETED',
  travelerId: 'u1',
  agencyId: 'a1',
  tourId: 't1',
  tourTitle: 'Ha Long',
  departureId: 'd1',
  departureDate: new Date(),
  participants: 2,
  contactName: 'Ann',
  totalAmount: 2_000_000,
  commissionAmount: 200_000,
  agencyAmount: 1_800_000,
} as const;

function make(tour: E | null) {
  const db: E[] = [];
  const repo = {
    create: vi.fn(async (data: E) => {
      const doc = { id: `e${db.length + 1}`, ...data };
      db.push(doc);
      return doc;
    }),
    findByBookingId: vi.fn(async (id: string) => db.find((e) => String(e.bookingId) === id) ?? null),
    listByGuide: vi.fn(async () => ({ items: db, total: db.length })),
    summarize: vi.fn(async () => [
      { month: '2026-10', totalAmount: 500_000, count: 2 },
      { month: '2026-09', totalAmount: 300_000, count: 1 },
    ]),
  };
  const tours = { getTourFacts: vi.fn(async () => tour) };
  const notifications = { notify: vi.fn(async () => undefined) };
  return { service: new EarningsService(repo as never, tours as never, notifications), repo, tours, notifications, db };
}

const acceptedTour = { id: 't1', agencyId: 'a1', title: 'Ha Long', status: 'APPROVED', guideId: 'g1', guideFee: 250_000 };

describe('recordForBooking', () => {
  it('credits the accepted guide with the agreed fee and tells them', async () => {
    const { service, repo, notifications } = make(acceptedTour);
    const earning = await service.recordForBooking(booking);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ guideId: 'g1', bookingId: 'b1', amount: 250_000, agencyId: 'a1' }));
    expect(earning).toMatchObject({ amount: 250_000, bookingCode: 'TRP-AAAA2222' });
    expect(notifications.notify).toHaveBeenCalledWith('g1', expect.objectContaining({ type: 'EARNING_RECORDED' }));
  });

  it('records nothing when the tour has no accepted guide (none, pending or declined)', async () => {
    const { service, repo } = make({ ...acceptedTour, guideId: undefined, guideFee: undefined });
    expect(await service.recordForBooking(booking)).toBeNull();
    expect(repo.create).not.toHaveBeenCalled();
    expect(await make(null).service.recordForBooking(booking)).toBeNull();
  });

  it('is idempotent per booking, including when two events race on the unique index', async () => {
    const { service, repo, notifications } = make(acceptedTour);
    await service.recordForBooking(booking);
    await service.recordForBooking(booking);
    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledTimes(1);

    const raced = make(acceptedTour);
    raced.repo.create.mockImplementationOnce(async () => {
      raced.db.push({ id: 'winner', bookingId: 'b1', bookingCode: 'x', tourId: 't1', tourTitle: 'x', amount: 1, earnedAt: new Date() });
      throw Object.assign(new Error('E11000'), { code: 'P2002' });
    });
    expect((await raced.service.recordForBooking(booking))?.id).toBe('winner');
    expect(raced.notifications.notify).not.toHaveBeenCalled();
  });

  it('rethrows unexpected storage errors so the event handler logs them', async () => {
    const { service, repo } = make(acceptedTour);
    repo.create.mockRejectedValueOnce(new Error('db down'));
    await expect(service.recordForBooking(booking)).rejects.toThrow('db down');
  });
});

describe('reading', () => {
  it('lists only through the guide id given by the caller and passes the date range', async () => {
    const { service, repo } = make(acceptedTour);
    const from = new Date('2026-01-01');
    await service.listMine('g1', { page: 1, limit: 20, from });
    expect(repo.listByGuide).toHaveBeenCalledWith('g1', { from, to: undefined }, expect.objectContaining({ page: 1, limit: 20 }));
  });

  it('summarises totals and months', async () => {
    const { service } = make(acceptedTour);
    expect(await service.summaryMine('g1', {})).toEqual({
      totalAmount: 800_000,
      count: 3,
      byMonth: [
        { month: '2026-10', totalAmount: 500_000, count: 2 },
        { month: '2026-09', totalAmount: 300_000, count: 1 },
      ],
    });
  });
});
