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
  summary?: string;
  description?: string;
  maxGroupSize?: number;
  images: string[];
  inclusions: string[];
  exclusions: string[];
  itinerary: TourItineraryDay[];
  departures: TourDeparture[];
  categories: TourCategory[];
  status: TourStatus;
  statusReason?: string;
  submittedAt?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
  guideAssignment?: { guideId: string; feePerBooking: number; status: string; respondedAt?: string; note?: string };
  guide?: { id: string; fullName: string; avatarUrl?: string };
}

export type TourStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'ARCHIVED';
export interface TourItineraryDay { day: number; title: string; description?: string; activities: string[]; }
export interface TourContentInput {
  title: string;
  summary?: string;
  description?: string;
  destination: string;
  durationDays: number;
  basePrice: number;
  maxGroupSize?: number;
  categoryIds: string[];
  images?: string[];
  inclusions?: string[];
  exclusions?: string[];
}
export type ExtractedTourCandidate = Partial<TourContentInput>;
export interface AgencyTourListResult { items: TourDetail[]; meta: TourListMeta; }
export interface TourApiError { success?: boolean; error?: { code?: string; message?: string; details?: unknown }; }

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

export interface TourDestination {
  destination: string;
  count: number;
  icon: string;
  description: string;
  colorClass?: string;
  iconBgClass?: string;
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
