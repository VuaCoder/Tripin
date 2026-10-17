import { configureStore } from '@reduxjs/toolkit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseApi } from '@/store/api/baseApi';
import authReducer from '@/features/auth/store/authSlice';
import { agencyComplaintsApi } from '../api/agencyComplaintsApi';

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

const COMPLAINT = {
  id: 'c1',
  targetType: 'TOUR',
  targetId: 't1',
  category: 'SERVICE_QUALITY',
  description: 'Hướng dẫn viên đến muộn',
  status: 'OPEN',
  reporterName: 'Nguyen A.',
  createdAt: '2026-10-10T00:00:00.000Z',
};
const META = { page: 1, limit: 10, total: 1, totalPages: 1 };

afterEach(() => vi.unstubAllGlobals());

describe('agencyComplaintsApi', () => {
  it('lists complaints with the status filter and unwraps items + meta', async () => {
    const fetchMock = mockFetch(response({ success: true, data: [COMPLAINT], meta: META }));
    const store = createTestStore();

    const result = await store.dispatch(agencyComplaintsApi.endpoints.getAgencyComplaints.initiate({ status: 'OPEN' }));

    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain('/agency/complaints?');
    expect(request.url).toContain('status=OPEN');
    expect(result.data).toEqual({ items: [COMPLAINT], meta: META });
  });

  it('posts the response text to /respond and returns the updated complaint', async () => {
    const answered = { ...COMPLAINT, status: 'AGENCY_RESPONDED', agencyResponse: { text: 'Xin lỗi quý khách', respondedAt: '2026-10-11T00:00:00.000Z' } };
    const fetchMock = mockFetch(response({ success: true, data: answered }));
    const store = createTestStore();

    const result = await store.dispatch(agencyComplaintsApi.endpoints.respondToComplaint.initiate({ id: 'c1', text: 'Xin lỗi quý khách' }));

    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.method).toBe('POST');
    expect(request.url).toMatch(/\/agency\/complaints\/c1\/respond$/);
    expect(await request.clone().json()).toEqual({ text: 'Xin lỗi quý khách' });
    expect('data' in result && result.data).toEqual(answered);
  });

  it('turns a 404 for a foreign complaint into an error, never a success', async () => {
    mockFetch(response({ success: false, error: { code: 'NOT_FOUND', message: 'Report not found' } }, 404));
    const store = createTestStore();

    const result = await store.dispatch(agencyComplaintsApi.endpoints.respondToComplaint.initiate({ id: 'other', text: 'Xin chào' }));

    expect('error' in result && result.error).toMatchObject({ status: 404 });
  });
});
