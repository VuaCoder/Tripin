import { describe, expect, it } from 'vitest';
import { assertVnd, calculateGuestPrice, MONEY_LIMITS, ratioVnd, safeVndNumber, sumVnd } from '@travel-platform/constants';
import { numericRecord } from '../money';
import { createTourBody, availabilityBody } from '../../modules/tours/tours.validation';
import { previewQuery, createPromotionBody } from '../../modules/promotions/promotions.validation';

describe('whole VND bounds and exact arithmetic', () => {
  it('prices bookings beyond Int32 and at the 50-billion ceiling', () => {
    expect(calculateGuestPrice(50_000_000, 50).subtotal).toBe(2_500_000_000);
    expect(calculateGuestPrice(MONEY_LIMITS.MAX_UNIT_PRICE, 50).subtotal).toBe(50_000_000_000);
    expect(() => calculateGuestPrice(MONEY_LIMITS.MAX_UNIT_PRICE + 1, 1)).toThrow(RangeError);
    expect(() => calculateGuestPrice(1, 51)).toThrow(RangeError);
    expect(() => assertVnd(MONEY_LIMITS.MAX_BOOKING_AMOUNT + 1, MONEY_LIMITS.MAX_BOOKING_AMOUNT)).toThrow(RangeError);
  });

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid money %s', (value) => {
    expect(() => assertVnd(value)).toThrow(RangeError);
    expect(() => calculateGuestPrice(value, 1)).toThrow(RangeError);
  });

  it('preserves floor commission and half-up age pricing, including large intermediate products', () => {
    for (const amount of [1, 2_147_483_647, 2_147_483_648, 49_999_999_999, Number.MAX_SAFE_INTEGER]) {
      for (const bps of [0, 1, 1234, 9999, 10000]) {
        expect(ratioVnd(amount, bps, 10000)).toBe(Number(BigInt(amount) * BigInt(bps) / 10000n));
      }
    }
    const pricing = { childMinAge: 2, adultMinAge: 12, childPercent: 50, infantPercent: 25 };
    expect(calculateGuestPrice(101, 3, { adults: 1, children: 1, infants: 1 }, pricing)).toMatchObject({ childUnitPrice: 51, infantUnitPrice: 25, subtotal: 177 });
  });

  it('maps persisted bigint values explicitly and guards report overflow', () => {
    const row = numericRecord({ id: 'b1', amount: 50_000_000_000n, optional: null });
    expect(JSON.parse(JSON.stringify(row))).toEqual({ id: 'b1', amount: 50_000_000_000, optional: null });
    expect(sumVnd([50_000_000_000, 50_000_000_000])).toBe(100_000_000_000);
    expect(safeVndNumber('9007199254740991')).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => safeVndNumber('9007199254740992')).toThrow(RangeError);
    expect(() => sumVnd([Number.MAX_SAFE_INTEGER, 1])).toThrow(RangeError);
  });

  it('enforces separate price and subtotal limits on HTTP inputs', () => {
    const id = '123e4567-e89b-42d3-a456-426614174000';
    const tour = { title: 'Luxury tour', destination: 'Vietnam', durationDays: 3, basePrice: 1_000_000_000, categoryIds: [id] };
    expect(createTourBody.safeParse(tour).success).toBe(true);
    expect(createTourBody.safeParse({ ...tour, basePrice: 1_000_000_001 }).success).toBe(false);
    const departures = [{ date: new Date(), capacity: 50, isOpen: true, priceOverride: 1_000_000_001 }];
    expect(availabilityBody.safeParse({ departures }).success).toBe(false);
    const preview = { code: 'SAVE10', tourId: id, subtotal: '50000000000' };
    expect(previewQuery.safeParse(preview).success).toBe(true);
    expect(previewQuery.safeParse({ ...preview, subtotal: '50000000001' }).success).toBe(false);
    const promo = { code: 'SAVE10', title: 'Save money', discountType: 'FIXED', discountValue: 3_000_000_000, minOrderAmount: 50_000_000_000, startsAt: new Date(), endsAt: new Date(Date.now() + 1000) };
    expect(createPromotionBody.safeParse(promo).success).toBe(true);
    expect(createPromotionBody.safeParse({ ...promo, discountValue: 50_000_000_001 }).success).toBe(false);
  });
});
