import { configureStore } from '@reduxjs/toolkit';
import { act, renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserProfile } from '@/features/auth';
import authReducer, { clearCredentials, setCredentials } from '@/features/auth/store/authSlice';
import { useTourReviewEligibility } from '../hooks/useTourReviewEligibility';
import type { MyReview, ReviewableBooking } from '../types';

const useGetMyCompletedBookingsQuery = vi.hoisted(() => vi.fn());
const useGetMyReviewsQuery = vi.hoisted(() => vi.fn());

vi.mock('../api/reviewApi', () => ({ useGetMyCompletedBookingsQuery, useGetMyReviewsQuery }));

const BOOKING: ReviewableBooking = {
  id: 'b1',
  bookingCode: 'TRP12345678',
  status: 'COMPLETED',
  tour: { id: 't1', title: 'Ha Long Bay 2N1Đ' },
  departureDate: '2026-01-01T00:00:00.000Z',
  participants: 2,
};

const REVIEW: MyReview = {
  id: 'r1',
  bookingId: 'b1',
  tourId: 't1',
  tourTitle: 'Ha Long Bay 2N1Đ',
  rating: 5,
  comment: 'Chuyến đi rất tuyệt vời!',
  status: 'VISIBLE',
  createdAt: '2026-02-01T00:00:00.000Z',
};

const TRAVELER: UserProfile = {
  id: 'u1',
  email: 'traveler@example.com',
  fullName: 'Nguyen Van An',
  role: 'TRAVELER',
  status: 'ACTIVE',
  permissions: [],
  extraPermissions: [],
  twoFactorEnabled: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const AGENCY: UserProfile = { ...TRAVELER, id: 'u2', email: 'agency@example.com', role: 'AGENCY' };

const queryState = (overrides: Record<string, unknown> = {}) => ({
  data: undefined,
  isLoading: false,
  isFetching: false,
  isError: false,
  refetch: vi.fn(),
  ...overrides,
});

let bookingsRefetch: ReturnType<typeof vi.fn>;
let reviewsRefetch: ReturnType<typeof vi.fn>;

const givenBookings = (items: ReviewableBooking[], overrides: Record<string, unknown> = {}) => {
  useGetMyCompletedBookingsQuery.mockReturnValue(queryState({ data: { items }, refetch: bookingsRefetch, ...overrides }));
};

const givenReviews = (items: MyReview[], overrides: Record<string, unknown> = {}) => {
  useGetMyReviewsQuery.mockReturnValue(queryState({ data: { items }, refetch: reviewsRefetch, ...overrides }));
};

const renderEligibility = (tourId: string, session: 'idle' | 'guest' | 'traveler' | 'agency') => {
  const store = configureStore({ reducer: { auth: authReducer } });
  if (session === 'traveler') store.dispatch(setCredentials({ accessToken: 'token', user: TRAVELER }));
  if (session === 'agency') store.dispatch(setCredentials({ accessToken: 'token', user: AGENCY }));
  if (session === 'guest') store.dispatch(clearCredentials());

  const wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;
  return renderHook(() => useTourReviewEligibility(tourId), { wrapper });
};

beforeEach(() => {
  bookingsRefetch = vi.fn();
  reviewsRefetch = vi.fn();
  useGetMyCompletedBookingsQuery.mockReset();
  useGetMyReviewsQuery.mockReset();
  givenBookings([]);
  givenReviews([]);
});

describe('useTourReviewEligibility', () => {
  it('waits for the session bootstrap instead of guessing', () => {
    const { result } = renderEligibility('t1', 'idle');

    expect(result.current.status).toBe('loading');
    expect(useGetMyCompletedBookingsQuery).toHaveBeenCalledWith(undefined, { skip: true });
    expect(useGetMyReviewsQuery).toHaveBeenCalledWith({ page: 1, limit: 100 }, { skip: true });
  });

  it('asks a guest to log in and never queries the owner-scoped endpoints', () => {
    const { result } = renderEligibility('t1', 'guest');

    expect(result.current.status).toBe('guest');
    expect(useGetMyCompletedBookingsQuery).toHaveBeenCalledWith(undefined, { skip: true });
  });

  it('does not offer the write action to a non-traveler role', () => {
    const { result } = renderEligibility('t1', 'agency');

    expect(result.current.status).toBe('not-traveler');
    expect(useGetMyCompletedBookingsQuery).toHaveBeenCalledWith(undefined, { skip: true });
  });

  it('is eligible when a COMPLETED booking of this tour has no review yet', () => {
    givenBookings([BOOKING]);
    givenReviews([]);

    const { result } = renderEligibility('t1', 'traveler');

    expect(result.current.status).toBe('eligible');
    expect(result.current.eligibleBookings).toEqual([BOOKING]);
    expect(useGetMyCompletedBookingsQuery).toHaveBeenCalledWith(undefined, { skip: false });
  });

  it('is not eligible without a COMPLETED booking of this tour', () => {
    givenBookings([{ ...BOOKING, tour: { id: 't2', title: 'Sa Pa 3N2Đ' } }]);

    const { result } = renderEligibility('t1', 'traveler');

    expect(result.current.status).toBe('not-completed');
    expect(result.current.eligibleBookings).toEqual([]);
  });

  it('reports an already-reviewed booking and keeps the review for display', () => {
    givenBookings([BOOKING]);
    givenReviews([REVIEW]);

    const { result } = renderEligibility('t1', 'traveler');

    expect(result.current.status).toBe('already-reviewed');
    expect(result.current.myReviews).toEqual([REVIEW]);
  });

  it('counts a hidden review as reviewed (one review per booking, hidden or not)', () => {
    givenBookings([BOOKING]);
    givenReviews([{ ...REVIEW, status: 'HIDDEN', hiddenReason: 'Spam' }]);

    const { result } = renderEligibility('t1', 'traveler');

    expect(result.current.status).toBe('already-reviewed');
  });

  it('stays eligible for the booking that has no review yet', () => {
    const second: ReviewableBooking = { ...BOOKING, id: 'b2', bookingCode: 'TRP99999999' };
    givenBookings([BOOKING, second]);
    givenReviews([REVIEW]);

    const { result } = renderEligibility('t1', 'traveler');

    expect(result.current.status).toBe('eligible');
    expect(result.current.eligibleBookings).toEqual([second]);
  });

  it('surfaces a failed check and retries both reads', () => {
    givenBookings([], { isError: true });
    givenReviews([]);

    const { result } = renderEligibility('t1', 'traveler');
    expect(result.current.status).toBe('error');

    act(() => result.current.retry());

    expect(bookingsRefetch).toHaveBeenCalledTimes(1);
    expect(reviewsRefetch).toHaveBeenCalledTimes(1);
  });
});
