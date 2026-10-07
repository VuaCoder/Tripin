/** The subset of the backend `tours` DTOs the cart's "add a tour" picker needs. */

export interface TourAgency {
  id: string;
  name: string;
  avatarUrl?: string;
}

/** Card in `GET /tours` (`TourListItemDto`). */
export interface TourListItem {
  id: string;
  title: string;
  summary?: string;
  destination: string;
  durationDays: number;
  basePrice: number;
  coverImage?: string;
  categoryIds: string[];
  ratingAvg: number;
  ratingCount: number;
  nextDepartureDate?: string;
  agency?: TourAgency;
}

export interface TourDeparture {
  id: string;
  date: string;
  capacity: number;
  remaining: number;
  price: number;
  isOpen: boolean;
}

/** `GET /tours/:id` (`TourDetailDto`) — only the fields used here; the response carries more. */
export interface TourDetail extends TourListItem {
  departures: TourDeparture[];
}

export interface TourApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string; details?: unknown };
}

export interface ListToursArgs {
  page?: number;
  limit?: number;
  q?: string;
  destination?: string;
}
