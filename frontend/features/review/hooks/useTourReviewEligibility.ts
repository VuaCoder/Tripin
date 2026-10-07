'use client';

import { useCallback, useMemo } from 'react';
import { selectAuthStatus, selectIsAuthenticated, selectRole } from '@/features/auth';
import { useAppSelector } from '@/store/hooks';
import { useGetMyCompletedBookingsQuery, useGetMyReviewsQuery } from '../api/reviewApi';
import { MY_REVIEWS_FETCH_LIMIT, type MyReview, type ReviewableBooking } from '../types';

export type ReviewEligibilityStatus =
  | 'loading'
  | 'guest'
  | 'not-traveler'
  | 'not-completed'
  | 'eligible'
  | 'already-reviewed'
  | 'error';

export interface ReviewEligibility {
  status: ReviewEligibilityStatus;
  /** COMPLETED bookings of this tour that have no review yet (what the dialog may post). */
  eligibleBookings: ReviewableBooking[];
  /** Every COMPLETED booking of this tour the traveler owns. */
  completedBookings: ReviewableBooking[];
  /** The traveler's own reviews of this tour, hidden ones included. */
  myReviews: MyReview[];
  /** Re-reads both eligibility queries after a failure or a stale `REVIEW_EXISTS`. */
  retry: () => void;
}

/**
 * "Write a review" eligibility, mirrored from the backend rule (only the owner of a COMPLETED booking can
 * review it, once per booking). The backend remains the authority — `POST /reviews` rejects anything this
 * pre-check would let through.
 *
 * The check reads the first `COMPLETED_BOOKINGS_FETCH_LIMIT` (100, the API maximum) completed bookings and
 * the first `MY_REVIEWS_FETCH_LIMIT` own reviews; a traveler beyond those volumes falls back to the
 * backend's answer on submit.
 */
export function useTourReviewEligibility(tourId: string): ReviewEligibility {
  const authStatus = useAppSelector(selectAuthStatus);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const role = useAppSelector(selectRole);

  const isTraveler = isAuthenticated && role === 'TRAVELER';

  const bookingsQuery = useGetMyCompletedBookingsQuery(undefined, { skip: !isTraveler });
  const reviewsQuery = useGetMyReviewsQuery({ page: 1, limit: MY_REVIEWS_FETCH_LIMIT }, { skip: !isTraveler });

  const { refetch: refetchBookings } = bookingsQuery;
  const { refetch: refetchReviews } = reviewsQuery;

  const completedBookings = useMemo(
    () => (bookingsQuery.data?.items ?? []).filter((booking) => booking.tour.id === tourId),
    [bookingsQuery.data, tourId],
  );

  const myReviews = useMemo(
    () => (reviewsQuery.data?.items ?? []).filter((review) => review.tourId === tourId),
    [reviewsQuery.data, tourId],
  );

  // One review per booking: any existing review (visible or hidden) takes its booking out of the running.
  const eligibleBookings = useMemo(() => {
    const reviewed = new Set(myReviews.map((review) => review.bookingId));
    return completedBookings.filter((booking) => !reviewed.has(booking.id));
  }, [completedBookings, myReviews]);

  const retry = useCallback(() => {
    void refetchBookings();
    void refetchReviews();
  }, [refetchBookings, refetchReviews]);

  const status = useMemo<ReviewEligibilityStatus>(() => {
    if (authStatus === 'idle') return 'loading';
    if (!isAuthenticated) return 'guest';
    if (role !== 'TRAVELER') return 'not-traveler';
    if (bookingsQuery.isError || reviewsQuery.isError) return 'error';
    if (bookingsQuery.isLoading || reviewsQuery.isLoading) return 'loading';
    if (eligibleBookings.length > 0) return 'eligible';
    if (completedBookings.length > 0) return 'already-reviewed';
    return 'not-completed';
  }, [
    authStatus,
    isAuthenticated,
    role,
    bookingsQuery.isError,
    bookingsQuery.isLoading,
    reviewsQuery.isError,
    reviewsQuery.isLoading,
    eligibleBookings.length,
    completedBookings.length,
  ]);

  return { status, eligibleBookings, completedBookings, myReviews, retry };
}
