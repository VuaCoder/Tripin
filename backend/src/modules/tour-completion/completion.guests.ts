import type { GuestCounts } from '@travel-platform/constants';

type BookingCounts = { participants: number; guestPricing?: unknown; passengerSnapshot?: unknown };
export function bookedGuestCounts(bookings: BookingCounts[]): GuestCounts {
  return bookings.reduce((total, booking) => {
    const guests = (booking.guestPricing as { guests?: GuestCounts } | null)?.guests;
    let counts: GuestCounts;
    if (guests && [guests.adults, guests.children, guests.infants].every(n => Number.isInteger(n) && n >= 0) && guests.adults + guests.children + guests.infants === booking.participants) {
      counts = guests;
    } else if (Array.isArray(booking.passengerSnapshot) && booking.passengerSnapshot.length === booking.participants &&
      booking.passengerSnapshot.every(p => p && ['ADULT', 'CHILD', 'INFANT'].includes(p.ageGroup))) {
      counts = { adults: 0, children: 0, infants: 0 };
      for (const p of booking.passengerSnapshot) counts[p.ageGroup === 'ADULT' ? 'adults' : p.ageGroup === 'CHILD' ? 'children' : 'infants']++;
    } else {
      // Legacy checkout without age selection charged and recorded every participant as an adult.
      counts = { adults: booking.participants, children: 0, infants: 0 };
    }
    return { adults: total.adults + counts.adults, children: total.children + counts.children, infants: total.infants + counts.infants };
  }, { adults: 0, children: 0, infants: 0 });
}
