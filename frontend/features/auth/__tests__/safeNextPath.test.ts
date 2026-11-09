import { describe, expect, it } from 'vitest';
import { safeNextPath } from '../utils/safeNextPath';

describe('Post-login return path', () => {
  it('keeps the complete booking selection', () => {
    const path = '/traveler/bookings/new?tourId=t1&departureId=d1&participants=4&adults=2&children=1&infants=1';
    expect(safeNextPath(path)).toBe(path);
  });
  it.each([null, 'https://example.com', '//example.com', '/\\example.com', '/\n/example.com'])('rejects a non-local navigation target: %s', value => {
    expect(safeNextPath(value)).toBeUndefined();
  });
});
