import { afterEach, describe, expect, it } from 'vitest';
import { atVietnam, calendarInstant, localParts, maxConcurrentEvents, readRememberedTime, rememberTime, tourColor, weeklyDates } from '../calendarTime';
afterEach(() => localStorage.clear());
describe('Agency calendar dates', () => {
  it('uses Vietnam time independently of the machine time zone and crosses UTC dates', () => {
    expect(atVietnam('2027-01-01', '00:30')).toBe('2026-12-31T17:30:00Z');
    expect(localParts('2026-12-31T17:30:00Z')).toEqual({ day: '2027-01-01', time: '00:30' });
  });
  it('materializes selected weekdays including the end date across a year', () => {
    expect(weeklyDates('2026-12-28', '2027-01-04', [1, 5], '08:00')).toEqual([
      '2026-12-28T01:00:00Z', '2027-01-01T01:00:00Z', '2027-01-04T01:00:00Z',
    ]);
  });
  it('rejects empty weekdays, reversed ranges, and more than 200 occurrences', () => {
    expect(() => weeklyDates('2027-01-01', '2027-02-01', [], '08:00')).toThrow();
    expect(() => weeklyDates('2027-02-01', '2027-01-01', [1], '08:00')).toThrow();
    expect(() => weeklyDates('2027-01-01', '2035-01-01', [1], '08:00')).toThrow(/200/);
  });
  it('remembers valid start times per agency and ignores corrupt storage', () => {
    expect(readRememberedTime('a')).toBe('08:00');
    rememberTime('a', '07:15'); expect(readRememberedTime('a')).toBe('07:15');
    expect(readRememberedTime('b')).toBe('08:00');
    rememberTime('a', '99:99'); expect(readRememberedTime('a')).toBe('08:00');
  });
  it('keeps the same tour color across ordering changes', () => {
    const color = tourColor('tour-1'); tourColor('tour-2'); expect(tourColor('tour-1')).toBe(color);
  });
  it('computes peak overlapping departures within the visible week without double counting adjacent tours', () => {
    const events = [
      { date: '2026-11-10T01:00:00Z', end: '2026-11-12T01:00:00Z' },
      { date: '2026-11-11T01:00:00Z', end: '2026-11-13T01:00:00Z' },
      { date: '2026-11-11T10:00:00Z', end: '2026-11-12T10:00:00Z' },
      { date: '2026-11-13T01:00:00Z', end: '2026-11-14T01:00:00Z' },
    ];
    expect(maxConcurrentEvents(events, '2026-11-09T00:00:00Z', '2026-11-16T00:00:00Z')).toBe(3);
  });
  it('resolves all-day, offset, and zone-less FullCalendar date strings in Vietnam time', () => {
    expect(calendarInstant('2026-11-15', true, '09:30')).toBe('2026-11-15T02:30:00Z');
    expect(calendarInstant('2026-11-15T09:30:00', false, '08:00')).toBe('2026-11-15T02:30:00Z');
    expect(calendarInstant('2026-11-15T09:30:00+07:00', false, '08:00')).toBe('2026-11-15T02:30:00Z');
  });
});
