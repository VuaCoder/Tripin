import { describe, expect, it } from 'vitest';
import { bookedGuestCounts } from '../completion.guests';
describe('completion age groups', () => {
  it('uses checkout groups first and passenger snapshots when pricing lacks age counts', () => {
    expect(bookedGuestCounts([
      { participants: 4, guestPricing: { guests: { adults: 2, children: 1, infants: 1 } } },
      { participants: 2, passengerSnapshot: [{ ageGroup: 'ADULT' }, { ageGroup: 'CHILD' }] },
    ])).toEqual({ adults: 3, children: 2, infants: 1 });
  });
  it('preserves the adult-only checkout default for legacy bookings and ignores inconsistent pricing totals', () => {
    expect(bookedGuestCounts([{ participants: 3 }, { participants: 2, guestPricing: { guests: { adults: 99, children: 0, infants: 0 } },
      passengerSnapshot: [{ ageGroup: 'ADULT' }, { ageGroup: 'INFANT' }] }])).toEqual({ adults: 4, children: 0, infants: 1 });
  });
});
