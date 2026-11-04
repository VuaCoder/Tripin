import { describe, expect, it } from 'vitest';
import {
  assertRefundable,
  continuousPremiumEnd,
  premiumDiscount,
} from '../premium.policy';
const date = (day: number) => new Date(Date.UTC(2026, 9, day));
describe('Premium policy', () => {
  it('requires a running period and only extends through contiguous non-revoked renewals', () => {
    expect(
      continuousPremiumEnd(
        [{ startsAt: date(26), endsAt: date(28) }],
        date(25),
      ),
    ).toBeNull();
    const periods = [
      { startsAt: date(20), endsAt: date(26) },
      { startsAt: date(26), endsAt: date(29) },
      { startsAt: date(30), endsAt: date(31) },
    ];
    expect(continuousPremiumEnd(periods, date(25))).toEqual(date(29));
    expect(
      continuousPremiumEnd(
        [
          ...periods,
          { startsAt: date(29), endsAt: date(30), revokedAt: date(25) },
        ],
        date(25),
      ),
    ).toEqual(date(29));
    expect(continuousPremiumEnd(periods, date(26))).toEqual(date(29));
  });
  it('caps integer VND and refuses wrong agency, tour and minimum spend', () => {
    const terms = {
      title: 'Test',
      agencyId: 'agency',
      tourIds: ['tour'],
      discountType: 'PERCENT' as const,
      discountValue: 15,
      maxDiscountAmount: 100,
      minOrderAmount: 100,
    };
    expect(premiumDiscount(terms, 'agency', 'tour', 111)).toBe(16);
    expect(premiumDiscount(terms, 'agency', 'tour', 10000)).toBe(100);
    expect(() => premiumDiscount(terms, 'other', 'tour', 1000)).toThrow();
    expect(() => premiumDiscount(terms, 'agency', 'other', 1000)).toThrow();
    expect(() => premiumDiscount(terms, 'agency', 'tour', 99)).toThrow();
  });
  it('only refunds non-revoked future periods, including exact start boundary', () => {
    expect(() =>
      assertRefundable({ startsAt: date(26), endsAt: date(28) }, date(25)),
    ).not.toThrow();
    expect(() =>
      assertRefundable({ startsAt: date(25), endsAt: date(28) }, date(25)),
    ).toThrow();
    expect(() =>
      assertRefundable(
        { startsAt: date(26), endsAt: date(28), revokedAt: date(24) },
        date(25),
      ),
    ).toThrow();
  });
});
