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

export interface TourListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TourListResult {
  items: TourListItem[];
  meta: TourListMeta;
}

export type TourListPageData = TourListResult;

export interface TourCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
}

export type TourSort = 'newest' | 'price_asc' | 'price_desc' | 'rating';

export interface TourApiResponse<T> {
  success: boolean;
  data: T;
  meta?: TourListMeta;
  error?: { code: string; message: string; details?: unknown };
}

export interface ListToursArgs {
  page?: number;
  limit?: number;
  q?: string;
  categoryId?: string;
  destination?: string;
  minPrice?: number;
  maxPrice?: number;
  minDays?: number;
  maxDays?: number;
  departureFrom?: string;
  departureTo?: string;
  minRating?: number;
  sort?: TourSort;
}
