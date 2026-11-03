import { describe, expect, it } from 'vitest';
import { calculateGuestPrice, MONEY_LIMITS } from '@travel-platform/constants';
import { validateTourEditor } from '../components/tourEditorValidation';

describe('tour price ceiling', () => {
  const tour = { title: 'Tour cao cấp', destination: 'Việt Nam', durationDays: 3, categoryIds: ['beach'], basePrice: MONEY_LIMITS.MAX_UNIT_PRICE };

  it('accepts one billion per person and rejects one dong over the limit', () => {
    expect(validateTourEditor(tour).basePrice).toBeUndefined();
    expect(validateTourEditor({ ...tour, basePrice: MONEY_LIMITS.MAX_UNIT_PRICE + 1 }).basePrice).toContain('1 tỷ');
  });

  it('previews the same 50-billion total as the backend', () => {
    expect(calculateGuestPrice(tour.basePrice, 50).subtotal).toBe(50_000_000_000);
  });
});
