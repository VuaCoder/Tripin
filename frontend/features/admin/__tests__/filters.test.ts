import { describe, expect, it } from 'vitest';
import { dateSelectionError, dateSelectionQuery, recentDays, normalizedSearch } from '../utils/filters';

describe('admin search and calendar filters', () => {
  it('uses inclusive Vietnam dates independently of the host timezone', () => {
    expect(dateSelectionQuery({ from: '2026-10-01', to: '2026-10-01' })).toEqual({ from: '2026-09-30T17:00:00.000Z', to: '2026-10-01T16:59:59.999Z' });
    expect(dateSelectionQuery({ from: '', to: '' })).toEqual({});
    expect(recentDays(7, new Date('2026-10-17T18:00:00Z'))).toEqual({ from: '2026-10-12', to: '2026-10-18' });
  });
  it('rejects partial, reversed or overly long ranges', () => {
    for (const value of [{ from: '2026-10-01', to: '' }, { from: '2026-10-05', to: '2026-10-01' }, { from: '2020-01-01', to: '2026-10-01' }]) expect(dateSelectionError(value, 366)).toBeTruthy();
    expect(dateSelectionError({ from: '', to: '' }, 366)).toBeNull();
    expect(dateSelectionError({ from: '2026-01-01', to: '2026-12-31' }, 366)).toBeNull();
  });
  it('matches Vietnamese text without requiring accents', () => expect(normalizedSearch(' Đà Nẵng ')).toBe('da nang'));
});
