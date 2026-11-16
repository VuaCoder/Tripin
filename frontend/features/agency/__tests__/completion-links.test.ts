import { describe, expect, it } from 'vitest';
import { notificationHref } from '@/features/custom-tours/links';
describe('completion notification links', () => {
  it('links the Agency to the exact departure and the traveler to the exact booking', () => {
    expect(notificationHref({ type: 'TOUR_COMPLETION_DUE', data: { tourId: 'tour', departureId: 'departure' } }, 'AGENCY')).toBe('/agency/completions?tourId=tour&departureId=departure');
    expect(notificationHref({ type: 'BOOKING_COMPLETED', data: { bookingId: 'booking' } }, 'TRAVELER')).toBe('/settings/history/booking');
  });
});
