import { describe, expect, it } from 'vitest';
import { authNextPath, safeNextPath } from '../utils/safeNextPath';

describe('Post-login return path', () => {
  it('replaces retired workplace screens without losing a continuation', () => {
    expect(authNextPath('/workplaces/start', '/')).toBe('/workplaces');
    expect(authNextPath('/workplaces/start?next=%2Fagency%2Fwork%2Ftours', '/')).toBe('/workplaces?next=%2Fagency%2Fwork%2Ftours');
    expect(authNextPath('/workplaces/join', '/')).toBe('/workplaces?join=1');
    expect(authNextPath('/workplaces/join?next=%2Fagency%2Fwork%2Ftours', '/')).toBe('/workplaces?next=%2Fagency%2Fwork%2Ftours&join=1');
  });
  it('keeps the complete booking selection', () => {
    const path = '/traveler/bookings/new?tourId=t1&departureId=d1&participants=4&adults=2&children=1&infants=1';
    expect(safeNextPath(path)).toBe(path);
  });
  it.each([null, 'https://example.com', '//example.com', '/\\example.com', '/\n/example.com'])('rejects a non-local navigation target: %s', value => {
    expect(safeNextPath(value)).toBeUndefined();
  });
});
