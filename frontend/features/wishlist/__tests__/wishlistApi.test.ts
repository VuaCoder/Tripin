import { configureStore } from '@reduxjs/toolkit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseApi } from '@/store/api/baseApi';
import authReducer from '@/features/auth/store/authSlice';
import { wishlistApi } from '../api/wishlistApi';

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

const META = { page: 1, limit: 12, total: 1, totalPages: 1 };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('wishlistApi', () => {
  it('GETs /wishlist with paging and keeps the meta', async () => {
    const items = [{ tourId: 't1', addedAt: '2026-01-01T00:00:00.000Z', available: false }];
    const fetchMock = mockFetch(response({ success: true, data: items, meta: META }));

    const result = await createTestStore().dispatch(wishlistApi.endpoints.getWishlist.initiate({ page: 2, limit: 5 }));

    const [request] = fetchMock.mock.calls[0] as [Request];
    expect(request.url).toMatch(/\/wishlist\?page=2&limit=5$/);
    expect(result.data).toEqual({ items, meta: META });
  });

  it('collects the saved tour ids across every page', async () => {
    const fetchMock = mockFetch(
      response({ success: true, data: [{ tourId: 't1' }, { tourId: 't2' }], meta: { ...META, totalPages: 2 } }),
      response({ success: true, data: [{ tourId: 't3' }], meta: { ...META, page: 2, totalPages: 2 } }),
    );

    const result = await createTestStore().dispatch(wishlistApi.endpoints.getWishlistTourIds.initiate());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.data).toEqual(['t1', 't2', 't3']);
  });

  it('POSTs /wishlist/:tourId', async () => {
    const fetchMock = mockFetch(response({ success: true, data: { tourId: 't1', saved: true } }, 201));

    await createTestStore().dispatch(wishlistApi.endpoints.addToWishlist.initiate('t1'));

    const [request] = fetchMock.mock.calls[0] as [Request];
    expect(request.url).toMatch(/\/wishlist\/t1$/);
    expect(request.method).toBe('POST');
  });

  it('DELETEs /wishlist/:tourId', async () => {
    const fetchMock = mockFetch(response(undefined, 204));

    await createTestStore().dispatch(wishlistApi.endpoints.removeFromWishlist.initiate('t1'));

    const [request] = fetchMock.mock.calls[0] as [Request];
    expect(request.url).toMatch(/\/wishlist\/t1$/);
    expect(request.method).toBe('DELETE');
  });

  it('surfaces WISHLIST_FULL untouched', async () => {
    mockFetch(response({ success: false, error: { code: 'WISHLIST_FULL', message: 'Wishlist is full' } }, 409));

    const result = await createTestStore().dispatch(wishlistApi.endpoints.addToWishlist.initiate('t1'));

    expect(result).toMatchObject({ error: { status: 409, data: { error: { code: 'WISHLIST_FULL' } } } });
  });
});
