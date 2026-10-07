import { configureStore } from '@reduxjs/toolkit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseApi } from '@/store/api/baseApi';
import authReducer from '@/features/auth/store/authSlice';
import { cartApi } from '../api/cartApi';
import type { Cart } from '../types';

/** Minimal `Response` stand-in: RTK Query's fetchBaseQuery reads `text()` and clones the response. */
const mockFetch = (body: unknown, status = 200) => {
  const payload = body === undefined ? '' : JSON.stringify(body);
  const response = {
    ok: status < 400,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => payload,
    json: async () => body,
    clone: () => response,
  };
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const createTestStore = () =>
  configureStore({
    // `auth` is required because baseApi.prepareHeaders reads the access token from it.
    reducer: { auth: authReducer, [baseApi.reducerPath]: baseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });

const CART: Cart = {
  items: [
    {
      id: 'c1',
      tourId: 't1',
      departureId: 'd1',
      participants: 2,
      addedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      available: true,
      unitPrice: 1_000_000,
      subtotal: 2_000_000,
    },
  ],
  totals: { itemCount: 1, participantCount: 2, availableCount: 1, unavailableCount: 0, subtotal: 2_000_000, currency: 'VND' },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('cartApi', () => {
  it('GETs /cart and unwraps the response envelope', async () => {
    const fetchMock = mockFetch({ success: true, data: CART });

    const result = await createTestStore().dispatch(cartApi.endpoints.getCart.initiate());

    const [request] = fetchMock.mock.calls[0] as [Request];
    expect(request.url).toMatch(/\/cart$/);
    expect(request.method).toBe('GET');
    expect(request.credentials).toBe('include');
    expect(result.data).toEqual(CART);
  });

  it('POSTs a new line to /cart/items', async () => {
    const fetchMock = mockFetch({ success: true, data: CART.items[0] }, 201);

    await createTestStore().dispatch(cartApi.endpoints.addCartItem.initiate({ tourId: 't1', departureId: 'd1', participants: 2 }));

    const [request] = fetchMock.mock.calls[0] as [Request];
    expect(request.url).toMatch(/\/cart\/items$/);
    expect(request.method).toBe('POST');
    expect(JSON.parse(await request.text())).toEqual({ tourId: 't1', departureId: 'd1', participants: 2 });
  });

  it('PATCHes only the head-count of one line', async () => {
    const fetchMock = mockFetch({ success: true, data: { ...CART.items[0], participants: 3 } });

    await createTestStore().dispatch(cartApi.endpoints.updateCartItem.initiate({ id: 'c1', participants: 3 }));

    const [request] = fetchMock.mock.calls[0] as [Request];
    expect(request.url).toMatch(/\/cart\/items\/c1$/);
    expect(request.method).toBe('PATCH');
    expect(JSON.parse(await request.text())).toEqual({ participants: 3 });
  });

  it('DELETEs one line', async () => {
    const fetchMock = mockFetch(undefined, 204);

    await createTestStore().dispatch(cartApi.endpoints.removeCartItem.initiate('c1'));

    const [request] = fetchMock.mock.calls[0] as [Request];
    expect(request.url).toMatch(/\/cart\/items\/c1$/);
    expect(request.method).toBe('DELETE');
  });

  it('surfaces the backend error (e.g. CART_FULL) untouched', async () => {
    mockFetch({ success: false, error: { code: 'CART_FULL', message: 'Your cart is full (20 departures)' } }, 409);

    const result = await createTestStore().dispatch(cartApi.endpoints.addCartItem.initiate({ tourId: 't1', departureId: 'd1', participants: 1 }));

    expect(result).toMatchObject({ error: { status: 409, data: { error: { code: 'CART_FULL' } } } });
  });
});
