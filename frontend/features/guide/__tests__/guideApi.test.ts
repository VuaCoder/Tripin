import { configureStore } from '@reduxjs/toolkit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseApi } from '@/store/api/baseApi';
import authReducer from '@/features/auth/store/authSlice';
import { guideApi } from '../api/guideApi';

/** Minimal `Response` stand-in: RTK Query's fetchBaseQuery reads `text()` and clones the response. */
const response = (body: unknown, status = 200) => {
  const payload = body === undefined ? '' : JSON.stringify(body);
  const res = {
    ok: status < 400,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => payload,
    json: async () => body,
    clone: () => res,
  };
  return res;
};

const mockFetch = (...responses: ReturnType<typeof response>[]) => {
  const fetchMock = vi.fn();
  responses.forEach((r) => fetchMock.mockResolvedValueOnce(r));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const createTestStore = () =>
  configureStore({
    reducer: { auth: authReducer, [baseApi.reducerPath]: baseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });

const GUIDED_TOUR = {
  id: '9f1c2b3a-4d5e-4f60-8a71-2b3c4d5e6f70',
  title: 'Tour Hạ Long 2N1Đ',
  destination: 'Quảng Ninh',
  durationDays: 2,
  tourStatus: 'APPROVED',
  agencyId: 'agency-1',
  agency: { id: 'agency-1', name: 'Tripri Travel' },
  assignment: { feePerBooking: 500_000, status: 'PENDING' as const },
  nextDepartureDate: '2026-12-01T00:00:00.000Z',
};

const META = { page: 1, limit: 10, total: 1, totalPages: 1 };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('guideApi', () => {
  it('GETs /guide/tours with paging and keeps the meta', async () => {
    const fetchMock = mockFetch(response({ success: true, data: [GUIDED_TOUR], meta: META }));

    const result = await createTestStore().dispatch(
      guideApi.endpoints.getAssignedTours.initiate({ page: 2, limit: 5 }),
    );

    const [request] = fetchMock.mock.calls[0] as [Request];
    expect(request.url).toMatch(/\/guide\/tours\?page=2&limit=5$/);
    expect(result.data).toEqual({ items: [GUIDED_TOUR], meta: META });
  });

  it('POSTs the answer to /guide/tours/:tourId/verification and unwraps data', async () => {
    const accepted = { ...GUIDED_TOUR, assignment: { ...GUIDED_TOUR.assignment, status: 'ACCEPTED' as const } };
    const fetchMock = mockFetch(response({ success: true, data: accepted }));

    const result = await createTestStore().dispatch(
      guideApi.endpoints.answerAssignment.initiate({ tourId: '9f1c2b3a-4d5e-4f60-8a71-2b3c4d5e6f70', accept: true, note: 'Sẵn sàng' }),
    );

    const [request] = fetchMock.mock.calls[0] as [Request];
    expect(request.url).toMatch(/\/guide\/tours\/9f1c2b3a-4d5e-4f60-8a71-2b3c4d5e6f70\/verification$/);
    expect(request.method).toBe('POST');
    expect(await request.json()).toEqual({ accept: true, note: 'Sẵn sàng' });
    expect(result.data).toEqual(accepted);
  });

  it('omits the note when the guide does not write one', async () => {
    const fetchMock = mockFetch(response({ success: true, data: GUIDED_TOUR }));

    await createTestStore().dispatch(
      guideApi.endpoints.answerAssignment.initiate({ tourId: '9f1c2b3a-4d5e-4f60-8a71-2b3c4d5e6f70', accept: false, note: undefined }),
    );

    const [request] = fetchMock.mock.calls[0] as [Request];
    expect(await request.json()).toEqual({ accept: false });
  });
});
