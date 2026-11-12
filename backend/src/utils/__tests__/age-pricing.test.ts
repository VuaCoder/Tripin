import { describe, expect, it } from 'vitest';
import { resolveGuestGroupCounts } from '@travel-platform/constants';
import { agePricingSchema } from '../age-pricing';

describe('agePricingSchema & resolveGuestGroupCounts', () => {
  it('accepts optional adult, child, and infant max group counts', () => {
    const parsed = agePricingSchema.safeParse({
      childMinAge: 2,
      adultMinAge: 13,
      childPercent: 100,
      infantPercent: 100,
      childPrice: 500000,
      infantPrice: 0,
      adultMaxCount: 20,
      childMaxCount: 6,
      infantMaxCount: 2,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects negative or excessive guest group counts', () => {
    const neg = agePricingSchema.safeParse({
      childMinAge: 2,
      adultMinAge: 13,
      childPercent: 100,
      infantPercent: 100,
      adultMaxCount: -1,
    });
    expect(neg.success).toBe(false);

    const huge = agePricingSchema.safeParse({
      childMinAge: 2,
      adultMinAge: 13,
      childPercent: 100,
      infantPercent: 100,
      infantMaxCount: 10001,
    });
    expect(huge.success).toBe(false);
  });

  it('resolves 3-group breakdown cleanly against departure capacity', () => {
    expect(resolveGuestGroupCounts(28, {
      childMinAge: 2,
      adultMinAge: 13,
      childPercent: 100,
      infantPercent: 100,
      adultMaxCount: 20,
      childMaxCount: 6,
      infantMaxCount: 2,
    })).toEqual({ adults: 20, children: 6, infants: 2 });

    expect(resolveGuestGroupCounts(10, null)).toEqual({ adults: 10, children: 0, infants: 0 });
  });
});
