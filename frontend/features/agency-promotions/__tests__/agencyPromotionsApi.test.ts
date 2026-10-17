import { configureStore } from '@reduxjs/toolkit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseApi } from '@/store/api/baseApi';
import authReducer from '@/features/auth/store/authSlice';
import { agencyPromotionsApi } from '../api/agencyPromotionsApi';

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

const PROMOTION = {
  id: 'p1',
  scope: 'AGENCY',
  code: 'HE2026',
  title: 'Giảm hè',
  discountType: 'PERCENT',
  discountValue: 10,
  minOrderAmount: 0,
  startsAt: '2026-11-01T00:00:00.000Z',
  endsAt: '2026-12-01T00:00:00.000Z',
  usedCount: 0,
  isActive: true,
  isRunning: false,
};

const META = { page: 1, limit: 10, total: 1, totalPages: 1 };

afterEach(() => vi.unstubAllGlobals());

describe('agencyPromotionsApi', () => {
  it('lists promotions with paging/filter params and unwraps items + meta', async () => {
    const fetchMock = mockFetch(response({ success: true, data: [PROMOTION], meta: META }));
    const store = createTestStore();

    const result = await store.dispatch(agencyPromotionsApi.endpoints.getAgencyPromotions.initiate({ page: 2, isActive: true }));

    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain('/agency/promotions?');
    expect(request.url).toContain('page=2');
    expect(request.url).toContain('isActive=true');
    expect(result.data).toEqual({ items: [PROMOTION], meta: META });
  });

  it('creates a promotion with POST and returns the backend DTO', async () => {
    const fetchMock = mockFetch(response({ success: true, data: PROMOTION }, 201));
    const store = createTestStore();

    const result = await store.dispatch(
      agencyPromotionsApi.endpoints.createAgencyPromotion.initiate({
        code: 'HE2026',
        title: 'Giảm hè',
        discountType: 'PERCENT',
        discountValue: 10,
        startsAt: PROMOTION.startsAt,
        endsAt: PROMOTION.endsAt,
      }),
    );

    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.method).toBe('POST');
    expect(request.url).toMatch(/\/agency\/promotions$/);
    expect('data' in result && result.data).toEqual(PROMOTION);
  });

  it('surfaces a backend error as a rejected mutation instead of a success', async () => {
    mockFetch(response({ success: false, error: { code: 'PROMOTION_CODE_EXISTS', message: 'exists' } }, 409));
    const store = createTestStore();

    const result = await store.dispatch(
      agencyPromotionsApi.endpoints.createAgencyPromotion.initiate({
        code: 'HE2026',
        title: 'Giảm hè',
        discountType: 'PERCENT',
        discountValue: 10,
        startsAt: PROMOTION.startsAt,
        endsAt: PROMOTION.endsAt,
      }),
    );

    expect('error' in result && result.error).toMatchObject({ status: 409 });
    expect('data' in result && result.data).toBeFalsy();
  });

  it('updates with PATCH on the promotion id', async () => {
    const fetchMock = mockFetch(response({ success: true, data: { ...PROMOTION, isActive: false } }));
    const store = createTestStore();

    await store.dispatch(agencyPromotionsApi.endpoints.updateAgencyPromotion.initiate({ id: 'p1', patch: { isActive: false } }));

    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.method).toBe('PATCH');
    expect(request.url).toMatch(/\/agency\/promotions\/p1$/);
  });
});
