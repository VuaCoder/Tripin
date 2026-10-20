import { configureStore } from '@reduxjs/toolkit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseApi } from '@/store/api/baseApi';
import authReducer from '@/features/auth/store/authSlice';
import { reportApi } from '../api/reportApi';

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

const requestOf = async (fetchMock: ReturnType<typeof mockFetch>, index = 0) => {
  const req = fetchMock.mock.calls[index][0] as Request;
  return { url: req.url, method: req.method, body: req.method === 'GET' ? undefined : await req.clone().json() };
};

afterEach(() => vi.unstubAllGlobals());

describe('reportApi wiring', () => {
  it('posts the report with the backend body shape and unwraps data', async () => {
    const fetchMock = mockFetch(response({ success: true, data: { id: 'r1', status: 'OPEN' } }, 201));
    const store = createTestStore();
    const result = await store.dispatch(
      reportApi.endpoints.createReport.initiate({
        targetType: 'TOUR',
        targetId: 't1',
        category: 'SAFETY',
        description: 'The bus had no seat belts at all.',
      }),
    );
    expect(result).toEqual({ data: { id: 'r1', status: 'OPEN' } });
    const req = await requestOf(fetchMock);
    expect(req.url).toContain('/reports');
    expect(req.method).toBe('POST');
    expect(req.body).toEqual({
      targetType: 'TOUR',
      targetId: 't1',
      category: 'SAFETY',
      description: 'The bus had no seat belts at all.',
    });
  });

  it('lists the reporter own reports with paging and the status filter', async () => {
    const meta = { page: 2, limit: 10, total: 11, totalPages: 2 };
    const fetchMock = mockFetch(response({ success: true, data: [{ id: 'r1' }], meta }));
    const store = createTestStore();
    const result = await store.dispatch(reportApi.endpoints.getMyReports.initiate({ page: 2, limit: 10, status: 'RESOLVED' }));
    expect(result.data).toEqual({ items: [{ id: 'r1' }], meta });
    const { url } = await requestOf(fetchMock);
    expect(url).toContain('/reports/me');
    expect(url).toContain('page=2');
    expect(url).toContain('limit=10');
    expect(url).toContain('status=RESOLVED');
  });

  it('falls back to a single page when the envelope carries no meta', async () => {
    mockFetch(response({ success: true, data: [{ id: 'r1' }, { id: 'r2' }] }));
    const store = createTestStore();
    const result = await store.dispatch(reportApi.endpoints.getMyReports.initiate());
    expect(result.data).toEqual({
      items: [{ id: 'r1' }, { id: 'r2' }],
      meta: { page: 1, limit: 2, total: 2, totalPages: 1 },
    });
  });

  it('surfaces a backend failure instead of success', async () => {
    mockFetch(response({ success: false, error: { code: 'REPORT_ALREADY_OPEN', message: 'x' } }, 409));
    const store = createTestStore();
    const result = await store.dispatch(
      reportApi.endpoints.createReport.initiate({ targetType: 'TOUR', targetId: 't1', category: 'OTHER', description: 'duplicate report here' }),
    );
    expect('error' in result && result.error).toBeTruthy();
    expect('data' in result && result.data).toBeFalsy();
  });
});
