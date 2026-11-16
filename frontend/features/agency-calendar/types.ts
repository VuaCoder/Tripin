import type { AgePricing } from '@travel-platform/constants';

export interface CalendarTour {
  id: string; title: string; durationDays: number; basePrice: number;
  coverImage?: string | null; status?: string; maxGroupSize?: number; agePricing?: AgePricing | null;
  /** PRIVATE belongs to one group-booking request: its departure is edited in that agreement, not here. */
  visibility?: 'PUBLIC' | 'PRIVATE';
}
export interface DepartureEvent {
  id: string; tourId: string; date: string; end: string; capacity: number; remaining: number;
  price: number; priceOverride: number | null; isOpen: boolean; tour: CalendarTour;
}
export interface NewDeparture {
  id: string; date: string; capacity: number; priceOverride?: number | null; isOpen: boolean;
}
export interface DeparturePatch {
  expectedDate: string; date?: string; capacity?: number; priceOverride?: number | null; isOpen?: boolean;
}
