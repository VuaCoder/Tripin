import { configureStore } from '@reduxjs/toolkit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseApi } from '@/store/api/baseApi';
import authReducer from '@/features/auth/store/authSlice';
import { moderationApi } from '../api/moderationApi';

const response = (body: unknown, status = 200) => {
  const payload = JSON.stringify(body);
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

const requestOf = async (fetchMock: ReturnType<typeof mockFetch>) => {
  const req = fetchMock.mock.calls[0][0] as Request;
  return { url: req.url, method: req.method, body: req.method === 'GET' ? undefined : await req.clone().json() };
};

afterEach(() => vi.unstubAllGlobals());

describe('moderationApi wiring', () => {
  it('lists tours with paging and filters and unwraps data + meta', async () => {
    const meta = { page: 1, limit: 10, total: 1, totalPages: 1 };
    const fetchMock = mockFetch(response({ success: true, data: [{ id: 't1' }], meta }));
    const store = createTestStore();
    const result = await store.dispatch(moderationApi.endpoints.getModerationTours.initiate({ status: 'APPROVED', q: 'a' }));
    expect(result.data).toEqual({ items: [{ id: 't1' }], meta });
    const { url } = await requestOf(fetchMock);
    expect(url).toContain('/moderation/tours');
    expect(url).toContain('status=APPROVED');
    expect(url).toContain('q=a');
    expect(url).toContain('limit=10');
  });

  it('posts validate with the backend body shape', async () => {
    const fetchMock = mockFetch(response({ success: true, data: { id: 't1', status: 'REJECTED' } }));
    const store = createTestStore();
    const result = await store.dispatch(moderationApi.endpoints.validateTour.initiate({ id: 't1', approve: false, reason: 'bad' }));
    expect(result).toEqual({ data: { id: 't1', status: 'REJECTED' } });
    const req = await requestOf(fetchMock);
    expect(req.url).toContain('/moderation/tours/t1/validate');
    expect(req.method).toBe('POST');
    expect(req.body).toEqual({ approve: false, reason: 'bad' });
  });

  it('posts suspend and verify', async () => {
    const fetchMock = mockFetch(response({ success: true, data: {} }), response({ success: true, data: {} }));
    const store = createTestStore();
    await store.dispatch(moderationApi.endpoints.suspendTour.initiate({ id: 't1', reason: 'bad' }));
    await store.dispatch(moderationApi.endpoints.verifyAgency.initiate({ id: 'u1', approve: true }));
    const a = fetchMock.mock.calls[0][0] as Request;
    const b = fetchMock.mock.calls[1][0] as Request;
    expect(a.url).toContain('/moderation/tours/t1/suspend');
    expect(await a.clone().json()).toEqual({ reason: 'bad' });
    expect(b.url).toContain('/moderation/agencies/u1/verify');
    expect(await b.clone().json()).toEqual({ approve: true });
  });

  it('surfaces backend failures instead of success', async () => {
    mockFetch(response({ success: false, error: { code: 'INVALID_TRANSITION', message: 'x' } }, 409));
    const store = createTestStore();
    const result = await store.dispatch(moderationApi.endpoints.suspendTour.initiate({ id: 't1', reason: 'bad' }));
    expect('error' in result && result.error).toBeTruthy();
    expect('data' in result && result.data).toBeFalsy();
  });

  it('reads the dashboard', async () => {
    const fetchMock = mockFetch(response({ success: true, data: { queues: { toursPendingReview: 2 } } }));
    const store = createTestStore();
    const result = await store.dispatch(moderationApi.endpoints.getModerationDashboard.initiate());
    expect(result.data).toEqual({ queues: { toursPendingReview: 2 } });
    expect((await requestOf(fetchMock)).url).toContain('/moderation/dashboard');
  });
});
