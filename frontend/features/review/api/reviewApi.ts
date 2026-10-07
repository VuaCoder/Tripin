import { baseApi } from '@/store/api/baseApi';
import {
  BOOKING_STATUS_COMPLETED,
  COMPLETED_BOOKINGS_FETCH_LIMIT,
  type CreateReviewInput,
  type MyReview,
  type MyReviewsArgs,
  type MyReviewsPage,
  type PublicReview,
  type ReviewableBooking,
  type ReviewableBookingsPage,
  type ReviewItemResponse,
  type ReviewListResponse,
  type TourReviewContext,
  type TourReviewsArgs,
  type TourReviewsPage,
} from '../types';

/**
 * The `reviews` HTTP contract plus the two supporting reads the flow needs.
 *
 * `getTourDetail` and `getMyCompletedBookings` are deliberately thin, read-only queries that live here
 * because the `tours` / `booking` features are not on this branch yet. When they land, swap them for
 * `useGetTourQuery` / `useGetMyBookingsQuery` and delete the two endpoints (nothing else changes).
 */
export const reviewApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** Header and rating summary of the thin public tour page (`GET /tours/:id`). */
    getTourDetail: build.query<TourReviewContext, string>({
      query: (id) => ({ url: `/tours/${id}` }),
      transformResponse: (response: ReviewItemResponse<TourReviewContext>) => response.data,
      providesTags: (result, error, id) => [{ type: 'Tour', id }],
    }),

    /** Eligibility input: the traveler's COMPLETED bookings (owner-scoped by the access token). */
    getMyCompletedBookings: build.query<ReviewableBookingsPage, void>({
      query: () => ({
        url: '/bookings/me',
        params: { status: BOOKING_STATUS_COMPLETED, limit: COMPLETED_BOOKINGS_FETCH_LIMIT },
      }),
      transformResponse: (response: ReviewListResponse<ReviewableBooking>) => ({
        items: response.data,
        meta: response.meta,
      }),
    }),

    /** Public reviews of one tour (`GET /reviews?tourId=`), newest / rating sorted. */
    getTourReviews: build.query<TourReviewsPage, TourReviewsArgs>({
      query: ({ tourId, sort, page, limit }) => ({ url: '/reviews', params: { tourId, sort, page, limit } }),
      transformResponse: (response: ReviewListResponse<PublicReview>) => ({
        items: response.data,
        meta: response.meta,
      }),
      providesTags: (result, error, { tourId }) => [{ type: 'Review', id: `TOUR-${tourId}` }],
    }),

    /** The traveler's own reviews, hidden ones included (`GET /reviews/me`). */
    getMyReviews: build.query<MyReviewsPage, MyReviewsArgs>({
      query: ({ page, limit }) => ({ url: '/reviews/me', params: { page, limit } }),
      transformResponse: (response: ReviewListResponse<MyReview>) => ({
        items: response.data,
        meta: response.meta,
      }),
      providesTags: [{ type: 'Review', id: 'ME' }],
    }),

    /**
     * `POST /reviews`. The tour and agency come from the booking server-side; a successful call
     * refreshes the public list, the traveler's own list and the tour's rating summary.
     */
    createReview: build.mutation<MyReview, CreateReviewInput>({
      query: (body) => ({ url: '/reviews', method: 'POST', body }),
      transformResponse: (response: ReviewItemResponse<MyReview>) => response.data,
      invalidatesTags: (result) =>
        result
          ? [
              { type: 'Review', id: 'ME' },
              { type: 'Review', id: `TOUR-${result.tourId}` },
              { type: 'Tour', id: result.tourId },
            ]
          : [{ type: 'Review', id: 'ME' }],
    }),
  }),
});

export const {
  useGetTourDetailQuery,
  useGetMyCompletedBookingsQuery,
  useGetTourReviewsQuery,
  useGetMyReviewsQuery,
  useCreateReviewMutation,
} = reviewApi;
