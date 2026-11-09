import { describe, it, expect } from 'vitest';
import { calculateGuestPrice } from '@travel-platform/constants';
describe('age pricing in whole VND', () => {
  it('uses fixed age prices, distinguishes free from unavailable, and rejects unavailable groups', () => {
    const fixed = { childMinAge: 2, adultMinAge: 13, childPercent: 50, infantPercent: 0, childPrice: 300000, infantPrice: 0 };
    expect(calculateGuestPrice(1000000, 3, { adults: 1, children: 1, infants: 1 }, fixed).subtotal).toBe(1300000);
    expect(() => calculateGuestPrice(1000000, 2, { adults: 1, children: 1, infants: 0 }, { ...fixed, childPrice: null })).toThrow('unavailable');
    expect(calculateGuestPrice(1000000, 2, { adults: 1, children: 0, infants: 1 }, { ...fixed, childPrice: null }).subtotal).toBe(1000000);
  });
  const pricing = { childMinAge: 2, adultMinAge: 12, childPercent: 50, infantPercent: 0 };
  it('rounds each child ticket before multiplying and counts infants as seats', () => {
    expect(calculateGuestPrice(100001, 5, { adults: 1, children: 3, infants: 1 }, pricing).subtotal).toBe(250004);
  });
  it('keeps legacy all-adult bookings unchanged', () => expect(calculateGuestPrice(1000000, 3).subtotal).toBe(3000000));
  it('does not allow children without an adult or totals different from participants', () => {
    expect(() => calculateGuestPrice(1, 1, { adults: 0, children: 1, infants: 0 }, pricing)).toThrow();
    expect(() => calculateGuestPrice(1, 3, { adults: 1, children: 1, infants: 0 }, pricing)).toThrow();
  });
});
