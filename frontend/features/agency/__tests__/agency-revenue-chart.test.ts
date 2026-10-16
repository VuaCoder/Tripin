import { describe, expect, it } from 'vitest';
import { rollingRevenueSeries, weeklyRevenueBuckets } from '../components/AgencyRevenueChart';

describe('Agency dashboard revenue chart', () => {
  it('fills the rolling UTC window without changing reported values or including older data', () => {
    const series = rollingRevenueSeries('2026-10-16T05:00:00Z', [
      { date: '2026-09-16', bookings: 1, net: 10 },
      { date: '2026-10-15', bookings: 2, net: 20 },
      { date: '2026-08-01', bookings: 5, net: 1000 },
    ]);
    expect(series).toHaveLength(31);
    expect(series[0]?.date).toBe('2026-09-16');
    expect(series[30]).toEqual({ date: '2026-10-16', bookings: 0, net: 0 });
    expect(series.reduce((total, point) => total + point.net, 0)).toBe(30);
  });
  it('aggregates Monday-based weeks and preserves total revenue and bookings across a month boundary', () => {
    const points = [
      { date: '2026-09-27', bookings: 1, net: 5 },
      { date: '2026-09-28', bookings: 2, net: 10 },
      { date: '2026-10-01', bookings: 3, net: 15 },
    ];
    const weeks = weeklyRevenueBuckets(points);
    expect(weeks).toHaveLength(2);
    expect(weeks[1]).toMatchObject({ week: '2026-09-28', from: '2026-09-28', to: '2026-10-01', bookings: 5, net: 25 });
    expect(weeks.reduce((total, week) => total + week.net, 0)).toBe(30);
  });
});
