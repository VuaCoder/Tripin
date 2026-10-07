import { configureStore } from '@reduxjs/toolkit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseApi } from '@/store/api/baseApi';
import authReducer from '@/features/auth/store/authSlice';
import { reviewApi } from '../api/reviewApi';
import type { MyReview, PublicReview, TourReviewContext } from '../types';

interface MockResponse {
  body: unknown;
  status?: number;
}

/**
 * Minimal `Response` stand-in with a queue: RTK Query's fetchBaseQuery reads `text()` and clones the
 * response, and the tag-invalidation test needs to follow request -> mutation -> refetch in order.
 */
const mockFetchQueue = (responses: MockResponse[]) => {
  const queue = [...responses];
  // The parameter is only there to type `mock.calls` as `[Request]`; RTK Query may pass `init` as well.
  const fetchMock = vi.fn(async (_request: Request) => {
    const next = queue.shift() ?? { body: { success: true, data: [] }, status: 200 };
    const status = next.status ?? 200;
    const payload = JSON.stringify(next.body);
    const response = {
      ok: status < 400,
      status,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => payload,
      json: async () => next.body,
      clone: () => response,
    };
    return response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const mockFetch = (body: unknown, status = 200) => mockFetchQueue([{ body, status }]);

const createTestStore = () =>
  configureStore({
    // `auth` is required because baseApi.prepareHeaders reads the access token from it.
    reducer: { auth: authReducer, [baseApi.reducerPath]: baseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });

const REVIEW: PublicReview = {
  id: 'r1',
  rating: 5,
  comment: 'Chuyến đi rất tuyệt vời, hướng dẫn viên thân thiện.',
  tourId: 't1',
  author: { name: 'Nguyen A.' },
  createdAt: '2026-02-01T00:00:00.000Z',
};

const MY_REVIEW: MyReview = {
  id: 'r1',
  bookingId: 'b1',
  tourId: 't1',
  tourTitle: 'Ha Long Bay 2N1Đ',
  rating: 5,
  comment: 'Chuyến đi rất tuyệt vời, hướng dẫn viên thân thiện.',
  status: 'VISIBLE',
  createdAt: '2026-02-01T00:00:00.000Z',
};

const TOUR: TourReviewContext = {
  id: 't1',
  title: 'Ha Long Bay 2N1Đ',
  destination: 'Quảng Ninh',
  durationDays: 2,
  basePrice: 1_850_000,
  ratingAvg: 4.8,
  ratingCount: 12,
};

const META = { page: 1, limit: 10, total: 1, totalPages: 1 };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('reviewApi reads', () => {
  it('GETs the visible reviews of one tour with the sort and page, unwrapping `data` + `meta`', async () => {
    const fetchMock = mockFetch({ success: true, data: [REVIEW], meta: { ...META, page: 2, totalPages: 2 } });

    const result = await createTestStore().dispatch(
      reviewApi.endpoints.getTourReviews.initiate({ tourId: 't1', sort: 'rating_desc', page: 2, limit: 10 }),
    );

    const [request] = fetchMock.mock.calls[0] as [Request];
    const url = new URL(request.url);
    expect(url.pathname).toMatch(/\/reviews$/);
    expect(url.searchParams.get('tourId')).toBe('t1');
    expect(url.searchParams.get('sort')).toBe('rating_desc');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(result.data).toEqual({ items: [REVIEW], meta: { ...META, page: 2, totalPages: 2 } });
  });

  it('GETs my own reviews, hidden ones included', async () => {
    const hidden: MyReview = { ...MY_REVIEW, id: 'r2', bookingId: 'b2', status: 'HIDDEN', hiddenReason: 'Spam' };
    const fetchMock = mockFetch({ success: true, data: [MY_REVIEW, hidden], meta: META });

    const result = await createTestStore().dispatch(
      reviewApi.endpoints.getMyReviews.initiate({ page: 1, limit: 100 }),
    );

    const [request] = fetchMock.mock.calls[0] as [Request];
    const url = new URL(request.url);
    expect(url.pathname).toMatch(/\/reviews\/me$/);
    expect(url.searchParams.get('limit')).toBe('100');
    expect(result.data?.items[1]).toMatchObject({ status: 'HIDDEN', hiddenReason: 'Spam' });
  });

  it('GETs my COMPLETED bookings for the eligibility check', async () => {
    const booking = {
      id: 'b1',
      bookingCode: 'TRP12345678',
      status: 'COMPLETED',
      tour: { id: 't1', title: 'Ha Long Bay 2N1Đ' },
      departureDate: '2026-01-01T00:00:00.000Z',
      participants: 2,
    };
    const fetchMock = mockFetch({ success: true, data: [booking], meta: META });

    const result = await createTestStore().dispatch(reviewApi.endpoints.getMyCompletedBookings.initiate());

    const [request] = fetchMock.mock.calls[0] as [Request];
    const url = new URL(request.url);
    expect(url.pathname).toMatch(/\/bookings\/me$/);
    expect(url.searchParams.get('status')).toBe('COMPLETED');
    expect(url.searchParams.get('limit')).toBe('100');
    expect(result.data?.items).toEqual([booking]);
  });

  it('GETs the tour detail the page header reads', async () => {
    const fetchMock = mockFetch({ success: true, data: TOUR });

    const result = await createTestStore().dispatch(reviewApi.endpoints.getTourDetail.initiate('t1'));

    const [request] = fetchMock.mock.calls[0] as [Request];
    expect(request.url).toMatch(/\/tours\/t1$/);
    expect(result.data).toEqual(TOUR);
  });
});

describe('reviewApi.createReview', () => {
  it('POSTs exactly the three fields the backend schema accepts', async () => {
    const fetchMock = mockFetch({ success: true, data: MY_REVIEW }, 201);

    const result = await createTestStore().dispatch(
      reviewApi.endpoints.createReview.initiate({
        bookingId: 'b1',
        rating: 5,
        comment: 'Chuyến đi rất tuyệt vời, hướng dẫn viên thân thiện.',
      }),
    );

    const [request] = fetchMock.mock.calls[0] as [Request];
    expect(request.url).toMatch(/\/reviews$/);
    expect(request.method).toBe('POST');
    const body = JSON.parse(await request.text()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['bookingId', 'comment', 'rating']);
    expect(body).toEqual({ bookingId: 'b1', rating: 5, comment: 'Chuyến đi rất tuyệt vời, hướng dẫn viên thân thiện.' });
    expect(result.data).toEqual(MY_REVIEW);
  });

  it('surfaces REVIEW_EXISTS untouched so the dialog can explain it', async () => {
    mockFetch({ success: false, error: { code: 'REVIEW_EXISTS', message: 'You already reviewed this booking' } }, 409);

    const result = await createTestStore().dispatch(
      reviewApi.endpoints.createReview.initiate({ bookingId: 'b1', rating: 5, comment: 'Một bình luận đủ dài.' }),
    );

    expect(result).toMatchObject({ error: { status: 409, data: { error: { code: 'REVIEW_EXISTS' } } } });
  });

  it('refreshes the subscribed tour list, my reviews and the tour rating after a review is created', async () => {
    const fetchMock = mockFetchQueue([
      { body: { success: true, data: [REVIEW], meta: META } },
      { body: { success: true, data: [MY_REVIEW], meta: META } },
      { body: { success: true, data: TOUR } },
      { body: { success: true, data: MY_REVIEW }, status: 201 },
      { body: { success: true, data: [MY_REVIEW, REVIEW], meta: { ...META, total: 2 } } },
      { body: { success: true, data: [MY_REVIEW], meta: META } },
      { body: { success: true, data: { ...TOUR, ratingCount: 13 }, } },
    ]);
    const store = createTestStore();

    await store.dispatch(
      reviewApi.endpoints.getTourReviews.initiate({ tourId: 't1', sort: 'newest', page: 1, limit: 10 }),
    );
    await store.dispatch(reviewApi.endpoints.getMyReviews.initiate({ page: 1, limit: 100 }));
    await store.dispatch(reviewApi.endpoints.getTourDetail.initiate('t1'));

    await store.dispatch(
      reviewApi.endpoints.createReview.initiate({ bookingId: 'b1', rating: 5, comment: 'Một bình luận đủ dài.' }),
    );

    const urls = () => fetchMock.mock.calls.map(([request]) => (request as Request).url);
    await vi.waitFor(() => {
      expect(urls().filter((url) => /\/reviews\?/.test(url))).toHaveLength(2);
      expect(urls().filter((url) => /\/reviews\/me/.test(url))).toHaveLength(2);
      expect(urls().filter((url) => /\/tours\/t1$/.test(url))).toHaveLength(2);
    });
  });
});
