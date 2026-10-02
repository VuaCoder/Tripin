import { describe, expect, it, vi } from 'vitest';
import { DashboardsService } from '../dashboards.service';
import { TtlCache } from '../../../utils/ttl-cache';

function make() {
  const bookings = {
    getAgencyStats: vi.fn(async (agencyId: string) => ({
      byStatus: { CONFIRMED: 3, PENDING: 1 },
      totals: { bookings: 3, gross: 3_000_000, commission: 300_000, net: 2_700_000 },
      last30Days: [{ date: '2026-10-01', bookings: 3, net: 2_700_000 }],
      topTours: [{ tourId: 't1', title: `Tour of ${agencyId}`, bookings: 3, net: 2_700_000 }],
    })),
    getPlatformStats: vi.fn(async () => ({
      byStatus: { CONFIRMED: 10 },
      totals: { bookings: 10, gross: 10_000_000, commission: 1_000_000, net: 9_000_000 },
      monthly: [{ month: '2026-10', bookings: 10, gross: 10_000_000, commission: 1_000_000 }],
    })),
  };
  const tours = { countByStatus: vi.fn(async (agencyId?: string): Promise<Record<string, number>> => (agencyId ? { APPROVED: 2, DRAFT: 1 } : { APPROVED: 20, PENDING_REVIEW: 4, DRAFT: 6 })) };
  const users = {
    getStats: vi.fn(async () => ({ byRole: { TRAVELER: 90, AGENCY: 8, TOUR_GUIDE: 2 }, byStatus: { ACTIVE: 95, PENDING_VERIFICATION: 5 }, newLast30Days: 12, agenciesPendingVerification: 3 })),
  };
  const reports = { countByStatus: vi.fn(async (): Promise<Record<string, number>> => ({ OPEN: 2, AGENCY_RESPONDED: 1, RESOLVED: 9 })), countOpenForAgency: vi.fn(async () => 2) };
  const support = { countByStatus: vi.fn(async (): Promise<Record<string, number>> => ({ OPEN: 5, IN_PROGRESS: 2, CLOSED: 40 })) };
  const reviews = { countByStatus: vi.fn(async (): Promise<Record<string, number>> => ({ VISIBLE: 100, HIDDEN: 3 })) };
  const payments = { paidTotal: vi.fn(async () => ({ amount: 1_990_000, count: 10 })) };
  const subscriptions = { countActive: vi.fn(async () => 7) };
  const service = new DashboardsService(bookings as never, tours as never, users as never, reports as never, support as never, reviews as never, payments as never, subscriptions as never);
  return { service, bookings, tours, users, reports, support, reviews, payments, subscriptions };
}

describe('agencyDashboard', () => {
  it('is scoped to the given agency in every underlying query', async () => {
    const { service, bookings, tours, reports } = make();
    const dashboard = await service.agencyDashboard('a1');
    expect(bookings.getAgencyStats).toHaveBeenCalledWith('a1');
    expect(tours.countByStatus).toHaveBeenCalledWith('a1');
    expect(reports.countOpenForAgency).toHaveBeenCalledWith('a1');
    expect(dashboard).toMatchObject({
      tours: { total: 3, byStatus: { APPROVED: 2, DRAFT: 1 } },
      revenue: { net: 2_700_000 },
      openComplaints: 2,
      topTours: [{ title: 'Tour of a1' }],
    });
  });

  it('never mixes agencies in the cache and serves repeated calls from it', async () => {
    const { service, bookings } = make();
    const a = await service.agencyDashboard('a1');
    const b = await service.agencyDashboard('a2');
    await service.agencyDashboard('a1');
    expect(a.topTours[0]!.title).toBe('Tour of a1');
    expect(b.topTours[0]!.title).toBe('Tour of a2');
    expect(bookings.getAgencyStats).toHaveBeenCalledTimes(2);
  });
});

describe('moderationDashboard', () => {
  it('summarises the queues that need a human', async () => {
    const { service } = make();
    expect(await service.moderationDashboard()).toMatchObject({
      queues: { toursPendingReview: 4, agenciesPendingVerification: 3, reportsOpen: 2, reportsAwaitingDecision: 1, supportTicketsOpen: 5, supportTicketsInProgress: 2 },
      reviews: { visible: 100, hidden: 3 },
    });
  });

  it('treats missing statuses as zero', async () => {
    const { service, tours, reports, support, reviews } = make();
    tours.countByStatus.mockResolvedValue({});
    reports.countByStatus.mockResolvedValue({});
    support.countByStatus.mockResolvedValue({});
    reviews.countByStatus.mockResolvedValue({});
    const dashboard = await service.moderationDashboard();
    expect(dashboard.queues).toMatchObject({ toursPendingReview: 0, reportsOpen: 0, supportTicketsOpen: 0 });
    expect(dashboard.reviews).toEqual({ visible: 0, hidden: 0 });
  });
});

describe('adminDashboard', () => {
  it('combines users, catalogue, money, subscriptions and moderation load', async () => {
    const { service, payments } = make();
    const dashboard = await service.adminDashboard();
    expect(payments.paidTotal).toHaveBeenCalledWith('SUBSCRIPTION');
    expect(dashboard).toMatchObject({
      users: { total: 100, newLast30Days: 12 },
      tours: { total: 30 },
      revenue: { gross: 10_000_000, commission: 1_000_000, subscriptions: { amount: 1_990_000, count: 10 } },
      subscriptions: { active: 7 },
      moderation: { reportsOpen: 3, supportTicketsOpen: 7 },
      monthly: [{ month: '2026-10' }],
    });
  });
});

describe('TtlCache', () => {
  it('expires entries, shares concurrent computations and does not cache failures', async () => {
    let now = 0;
    const cache = new TtlCache<number>(1000, 500, () => now);
    const compute = vi.fn(async () => 42);
    await Promise.all([cache.getOrCompute('k', compute), cache.getOrCompute('k', compute)]);
    expect(compute).toHaveBeenCalledTimes(1);
    now = 999;
    await cache.getOrCompute('k', compute);
    expect(compute).toHaveBeenCalledTimes(1);
    now = 1001;
    await cache.getOrCompute('k', compute);
    expect(compute).toHaveBeenCalledTimes(2);

    const failing = vi.fn(async () => {
      throw new Error('db down');
    });
    await expect(cache.getOrCompute('bad', failing)).rejects.toThrow('db down');
    await expect(cache.getOrCompute('bad', failing)).rejects.toThrow('db down');
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it('is bounded', async () => {
    const cache = new TtlCache<number>(60_000, 3);
    for (let i = 0; i < 10; i += 1) await cache.getOrCompute(`k${i}`, async () => i);
    const recompute = vi.fn(async () => 0);
    await cache.getOrCompute('k9', recompute);
    expect(recompute).not.toHaveBeenCalled();
  });
});
