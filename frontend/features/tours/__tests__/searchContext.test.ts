import { describe, expect, it } from 'vitest';
import { guestSearchParams, readSearchGuests, tourDetailHref } from '../utils/searchContext';

describe('Search handoff', () => {
  it('carries 2 adults, 1 child and 1 infant from home through the tour card', () => {
    const params = guestSearchParams({ adults: 2, children: 1, infants: 1 });
    expect(params.get('guests')).toBe('4');
    params.set('departureFrom', '2027-01-14');
    params.set('sort', 'rating');
    const next = new URL(tourDetailHref('t1', params), 'http://localhost');
    expect(readSearchGuests(next.searchParams)).toEqual({ adults: 2, children: 1, infants: 1 });
    expect(next.searchParams.get('departureFrom')).toBe('2027-01-14');
    expect(next.searchParams.has('sort')).toBe(false);
  });
  it.each(['guests=-2', 'adults=NaN&children=1.5', 'adults=50&children=1', 'guests=Infinity'])('handles malformed counts: %s', query => {
    expect(readSearchGuests(new URLSearchParams(query))).toEqual({ adults: 1, children: 0, infants: 0 });
  });
});
