import { describe, expect, it, vi } from 'vitest';
import { BookingsService } from '../bookings.service';

describe('agency six-month revenue', () => {
  it('uses agency-scoped paid-day data, fills six calendar months and handles year rollover', async () => {
    const repo = {
      statusCounts: vi.fn(async () => ({})),
      revenueTotals: vi.fn(async () => ({ bookings: 2, gross: 100, commission: 10, net: 90 })),
      topTours: vi.fn(async () => []),
      customerCount: vi.fn(async () => 2),
      dailyNet: vi.fn(async () => [
        { date: '2025-12-31', bookings: 1, net: 40 },
        { date: '2026-01-01', bookings: 1, net: 50 },
        { date: '2026-02-01', bookings: 1, net: 999 },
      ]),
    };
    const stats = await new BookingsService(repo as never).getAgencyStats('agency-1', new Date('2026-01-16T12:00:00Z'));
    expect(repo.customerCount).toHaveBeenCalledWith('agency-1');
    expect(stats.customers).toBe(2);
    expect(repo.dailyNet).toHaveBeenCalledWith('agency-1', new Date('2025-08-01T00:00:00Z'), new Date('2026-01-16T12:00:00Z'));
    expect(stats.last6Months).toEqual([
      { month: '2025-08', bookings: 0, net: 0 }, { month: '2025-09', bookings: 0, net: 0 },
      { month: '2025-10', bookings: 0, net: 0 }, { month: '2025-11', bookings: 0, net: 0 },
      { month: '2025-12', bookings: 1, net: 40 }, { month: '2026-01', bookings: 1, net: 50 },
    ]);
  });
});
