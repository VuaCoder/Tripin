import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MyReview, PublicReview, ReviewableBooking } from '../types';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const refetch = vi.hoisted(() => vi.fn());
const getTourReviews = vi.hoisted(() => vi.fn());
vi.mock('../api/reviewApi', () => ({ useGetTourReviewsQuery: (...args: unknown[]) => getTourReviews(...args) }));

const eligibility = vi.hoisted(() => vi.fn());
vi.mock('../hooks', () => ({ useTourReviewEligibility: (...args: unknown[]) => eligibility(...args) }));

const CREATED = vi.hoisted(
  (): MyReview => ({
    id: 'r9',
    bookingId: 'b1',
    tourId: 't1',
    tourTitle: 'Ha Long Bay 2N1Đ',
    rating: 4,
    comment: 'Chuyến đi rất tuyệt vời!',
    status: 'VISIBLE',
    createdAt: '2026-02-02T00:00:00.000Z',
  }),
);

// The dialog has its own test: here only its open/close wiring and the created-review hand-off matter.
vi.mock('../components/WriteReviewDialog', async () => {
  const { createElement } = await import('react');
  return {
    WriteReviewDialog: ({ open, onCreated }: { open: boolean; onCreated: (review: MyReview) => void }) =>
      open
        ? createElement('button', { 'data-testid': 'dialog-open', onClick: () => onCreated(CREATED) }, 'mock-submit')
        : null,
  };
});

import { TourReviewsSection } from '../components/TourReviewsSection';

const REVIEW_A: PublicReview = {
  id: 'r1',
  rating: 5,
  comment: 'Chuyến đi rất tuyệt vời, hướng dẫn viên thân thiện.',
  tourId: 't1',
  author: { name: 'Nguyen A.' },
  createdAt: '2026-02-01T00:00:00.000Z',
};

const REVIEW_B: PublicReview = { ...REVIEW_A, id: 'r2', rating: 3, comment: 'Lịch trình hơi nhanh.', author: { name: 'Tran B.' } };

const BOOKING: ReviewableBooking = {
  id: 'b1',
  bookingCode: 'TRP12345678',
  status: 'COMPLETED',
  tour: { id: 't1', title: 'Ha Long Bay 2N1Đ' },
  departureDate: '2026-01-01T00:00:00.000Z',
  participants: 2,
};

const MY_REVIEW: MyReview = {
  ...CREATED,
  id: 'r1',
  bookingId: 'b1',
  comment: 'Đánh giá của tôi về chuyến đi này.',
};

const eligible = (overrides: Record<string, unknown> = {}) => ({
  status: 'eligible',
  eligibleBookings: [BOOKING],
  completedBookings: [BOOKING],
  myReviews: [],
  retry: vi.fn(),
  ...overrides,
});

const reviewState = (overrides: Record<string, unknown> = {}) => ({
  data: { items: [] as PublicReview[], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } },
  isLoading: false,
  isFetching: false,
  isError: false,
  refetch,
  ...overrides,
});

/** Page 2 repeats REVIEW_A on purpose: the list must not show the same review twice. */
let pages: Record<number, PublicReview[]> = {};
const givenPages = (next: Record<number, PublicReview[]>) => {
  pages = next;
};
const META = (page: number) => ({ page, limit: 10, total: 11, totalPages: 3 });

const renderSection = () =>
  render(<TourReviewsSection tourId="t1" tourTitle="Ha Long Bay 2N1Đ" ratingAvg={4.8} ratingCount={12} />);

beforeEach(() => {
  push.mockReset();
  refetch.mockReset();
  eligibility.mockReset().mockReturnValue(eligible());
  getTourReviews.mockReset();
  pages = {};

  // RTK Query hands back a stable cache entry per argument set; mirror that so effects do not re-run.
  const cache = new Map<number, ReturnType<typeof reviewState>>();
  getTourReviews.mockImplementation((args: { page: number }) => {
    if (!cache.has(args.page)) {
      cache.set(args.page, reviewState({ data: { items: pages[args.page] ?? [], meta: META(args.page) } }));
    }
    return cache.get(args.page);
  });
});

afterEach(cleanup);

describe('TourReviewsSection', () => {
  it('shows the loading state while the first page is fetched', () => {
    getTourReviews.mockReturnValue(reviewState({ data: undefined, isLoading: true }));
    renderSection();

    expect(screen.getByText('Đang tải đánh giá...')).toBeTruthy();
  });

  it('shows the error state and retries', () => {
    getTourReviews.mockReturnValue(reviewState({ data: undefined, isError: true }));
    renderSection();

    expect(screen.getByText('Không tải được đánh giá')).toBeTruthy();
    fireEvent.click(screen.getByText('Thử lại'));
    expect(refetch).toHaveBeenCalled();
  });

  it('shows the empty state when the tour has no review yet', () => {
    renderSection();

    expect(screen.getByText('Chưa có đánh giá nào')).toBeTruthy();
  });

  it('renders the reviews with the tour rating summary', () => {
    givenPages({ 1: [REVIEW_A] });
    renderSection();

    expect(screen.getByText('4.8/5 · 12 đánh giá')).toBeTruthy();
    expect(screen.getByText('Nguyen A.')).toBeTruthy();
    expect(screen.getByText(REVIEW_A.comment)).toBeTruthy();
    expect(screen.getByText(/\d{2}\/\d{2}\/\d{4}/)).toBeTruthy();
  });

  it('re-reads the list from page 1 when the sort changes', () => {
    renderSection();

    fireEvent.change(screen.getByLabelText(/Sắp xếp/), { target: { value: 'rating_desc' } });

    const lastArgs = getTourReviews.mock.calls.at(-1)?.[0] as { sort: string; page: number };
    expect(lastArgs).toMatchObject({ sort: 'rating_desc', page: 1, tourId: 't1' });
  });

  it('appends the next page without duplicating a review', async () => {
    givenPages({ 1: [REVIEW_A], 2: [REVIEW_B, REVIEW_A] });
    renderSection();

    fireEvent.click(screen.getByText('Xem thêm đánh giá'));

    await waitFor(() => expect(screen.getByText('Lịch trình hơi nhanh.')).toBeTruthy());
    expect(screen.getAllByText(REVIEW_A.comment)).toHaveLength(1);
    expect((getTourReviews.mock.calls.at(-1)?.[0] as { page: number }).page).toBe(2);
  });

  it('asks a guest to log in and comes back to the tour afterwards', () => {
    eligibility.mockReturnValue(eligible({ status: 'guest', eligibleBookings: [] }));
    renderSection();

    fireEvent.click(screen.getByText('Đăng nhập để đánh giá'));

    expect(push).toHaveBeenCalledWith('/login?next=%2Ftours%2Ft1');
  });

  it('keeps the write action unavailable without a completed booking', () => {
    eligibility.mockReturnValue(eligible({ status: 'not-completed', eligibleBookings: [] }));
    renderSection();

    const button = screen.getByRole('button', { name: 'Viết đánh giá' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText('Bạn chỉ có thể đánh giá sau khi một chuyến đi của tour này hoàn thành.')).toBeTruthy();
  });

  it('shows the existing review instead of the write action once reviewed', () => {
    eligibility.mockReturnValue(eligible({ status: 'already-reviewed', eligibleBookings: [], myReviews: [MY_REVIEW] }));
    renderSection();

    expect(screen.getByText('Bạn đã đánh giá tour này')).toBeTruthy();
    expect(screen.getByText(MY_REVIEW.comment)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Viết đánh giá' })).toBeNull();
  });

  it('opens the write dialog for an eligible traveler', () => {
    renderSection();

    expect(screen.queryByTestId('dialog-open')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Viết đánh giá' }));
    expect(screen.getByTestId('dialog-open')).toBeTruthy();
  });

  it('confirms the created review and brings the list back to page 1', async () => {
    givenPages({ 1: [REVIEW_A], 2: [REVIEW_B, REVIEW_A] });
    renderSection();

    fireEvent.click(screen.getByText('Xem thêm đánh giá'));
    await waitFor(() => expect(screen.getByText('Lịch trình hơi nhanh.')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Viết đánh giá' }));
    fireEvent.click(screen.getByTestId('dialog-open'));

    await waitFor(() => expect(screen.getByText('Cảm ơn bạn! Đánh giá đã được đăng.')).toBeTruthy());
    expect((getTourReviews.mock.calls.at(-1)?.[0] as { page: number }).page).toBe(1);
    expect(screen.queryByText('Lịch trình hơi nhanh.')).toBeNull();
    expect(screen.queryByTestId('dialog-open')).toBeNull();
  });
});
