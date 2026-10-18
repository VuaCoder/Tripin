import { describe, it, expect } from 'vitest';
import { calculateGuestPrice } from '@travel-platform/constants';
describe('age pricing in whole VND', () => {
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
