/**
 * Mirrors the backend `reviews` module contracts (`backend/src/modules/reviews/reviews.types.ts`).
 * The backend stays the source of truth: these types only describe what the UI reads and sends.
 */

export type ReviewSort = 'newest' | 'rating_desc' | 'rating_asc';

export type ReviewStatus = 'VISIBLE' | 'HIDDEN';

/** Public representation: the backend masks the author (`Nguyen A.`) and never exposes traveler ids. */
export interface PublicReview {
  id: string;
  rating: number;
  comment: string;
  tourId: string;
  author: { name: string; avatarUrl?: string };
  createdAt: string;
}

/** The author's own view: includes the moderation state, which the public list hides. */
export interface MyReview {
  id: string;
  bookingId: string;
  tourId: string;
  tourTitle: string;
  rating: number;
  comment: string;
  status: ReviewStatus;
  hiddenReason?: string;
  createdAt: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** The paginated envelope of the API: the rows live in `data`, the paging in `meta`. */
export interface ReviewListResponse<T> {
  success: boolean;
  data: T[];
  meta?: PageMeta;
  error?: { code: string; message: string; details?: unknown };
}

/** The single-item envelope (`POST /reviews`, `GET /tours/:id`). */
export interface ReviewItemResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string; details?: unknown };
}

/** Exactly what `POST /reviews` accepts (the backend schema is `.strict()`). */
export interface CreateReviewInput {
  bookingId: string;
  rating: number;
  comment: string;
}

export interface TourReviewsArgs {
  tourId: string;
  page: number;
  limit: number;
  sort: ReviewSort;
}

export interface MyReviewsArgs {
  page: number;
  limit: number;
}

/**
 * The subset of `TourDetailDto` (`GET /tours/:id`) this feature reads: the thin tour page header and
 * the rating summary above the review list.
 */
export interface TourReviewContext {
  id: string;
  title: string;
  destination: string;
  durationDays: number;
  basePrice: number;
  coverImage?: string;
  description?: string;
  ratingAvg: number;
  ratingCount: number;
  agency?: { id: string; name: string; avatarUrl?: string };
}

/** The subset of `BookingDto` the eligibility check needs (`GET /bookings/me`). */
export interface ReviewableBooking {
  id: string;
  bookingCode: string;
  status: string;
  tour: { id: string; title: string };
  departureDate: string;
  participants: number;
}

export interface ReviewableBookingsPage {
  items: ReviewableBooking[];
  meta?: PageMeta;
}

export interface TourReviewsPage {
  items: PublicReview[];
  meta?: PageMeta;
}

export interface MyReviewsPage {
  items: MyReview[];
  meta?: PageMeta;
}

// ---------------------------------------------------------------- rules & limits
// Mirrored from the backend (`reviews.validation.ts` / `utils/pagination.ts`) — keep both in sync.

export const REVIEW_RATING_MIN = 1;
export const REVIEW_RATING_MAX = 5;
export const REVIEW_COMMENT_MIN = 10;
export const REVIEW_COMMENT_MAX = 2000;

export const REVIEW_PAGE_SIZE = 10;
/** Backend `MAX_PAGE_SIZE` (100): how many completed bookings / own reviews one eligibility check reads. */
export const MY_REVIEWS_FETCH_LIMIT = 100;
export const COMPLETED_BOOKINGS_FETCH_LIMIT = 100;

export const BOOKING_STATUS_COMPLETED = 'COMPLETED';
