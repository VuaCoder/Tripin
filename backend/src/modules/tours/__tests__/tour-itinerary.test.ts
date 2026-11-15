import { describe, expect, it } from 'vitest';
import { itineraryCoveredDays, validateTourItinerary } from '@travel-platform/constants';
import { createTourBody } from '../tours.validation';

describe('shared itinerary validation', () => {
  it('allows partial drafts and requires a complete program only for review', () => {
    expect(validateTourItinerary([], 3)).toBeUndefined();
    expect(validateTourItinerary([], 3, true)?.message).toContain('1, 2, 3');
    expect(validateTourItinerary([{ day: 1, toDay: 3, title: 'Whole trip' }], 3, true)).toBeUndefined();
  });
  it.each([
    [{ day: 0, title: 'Bad day' }], [{ day: 1.5, title: 'Bad day' }],
    [{ day: 1, toDay: 4, title: 'Too long' }], [{ day: 2, toDay: 1, title: 'Inverted' }],
    [{ day: 1, title: 'x' }], [{ day: 1, title: 'Good title', activities: [''] }],
    [{ day: 1, toDay: 2, title: 'Group' }, { day: 2, title: 'Overlap' }],
  ])('rejects malformed programs %j', (...days) => {
    expect(validateTourItinerary(days, 3)).toBeTruthy();
  });
  it('counts grouped days without double counting and caps coverage at the tour duration', () => {
    expect(itineraryCoveredDays([{ day: 1, toDay: 3, title: '' }, { day: 2, title: '' }], 3)).toEqual([1, 2, 3]);
    expect(itineraryCoveredDays([], 100000)).toEqual([]);
  });
  it('accepts a program in the initial create payload', () => {
    expect(createTourBody.parse({ title: 'Tour hợp lệ', destination: 'Hà Nội', durationDays: 2, basePrice: 1000000, categoryIds: ['00000000-0000-4000-8000-000000000001'], itinerary: [{ day: 1, toDay: 2, title: 'Khám phá Hà Nội' }] }).itinerary).toHaveLength(1);
  });
});
