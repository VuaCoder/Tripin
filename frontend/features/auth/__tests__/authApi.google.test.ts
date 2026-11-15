import { configureStore } from '@reduxjs/toolkit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseApi } from '@/store/api/baseApi';
import { authApi } from '../api/authApi';
import authReducer from '../store/authSlice';
import { restoreCredentials } from '../store/authSlice';
import { refreshSessionChecked } from '@/store/api/baseApi';

/**
 * Minimal `Response` stand-in: RTK Query's fetchBaseQuery reads `text()` (and clones the
 * response for meta), so `json()` alone is not enough.
 */
const mockFetch = (body: unknown, ok = true) => {
  const payload = JSON.stringify(body);
  const response = {
    ok,
    status: ok ? 200 : 401,
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

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Low-entropy placeholder: the test only asserts the request body round-trips, so this is
 * deliberately not a password-shaped literal (secret scanners flag those in fixtures).
 */
const FAKE_PASSWORD = 'x'.repeat(12);

describe('authApi.loginWithGoogle', () => {
  it('POSTs the ID token to /auth/google with credentials so the refresh cookie is stored', async () => {
    const fetchMock = mockFetch({ success: true, data: { accessToken: 't', user: { id: 'u1' } } });

    const result = await createTestStore().dispatch(
      authApi.endpoints.loginWithGoogle.initiate({ idToken: 'id-token-123456' }),
    );

    const [request] = fetchMock.mock.calls[0] as [Request];
    expect(request.url).toMatch(/\/auth\/google$/);
    expect(request.method).toBe('POST');
    expect(request.credentials).toBe('include');
    expect(JSON.parse(await request.text())).toEqual({ idToken: 'id-token-123456' });
    // transformResponse unwraps `{ success, data }` down to the session.
    expect(result).toMatchObject({ data: { accessToken: 't', user: { id: 'u1' } } });
  });

  it('surfaces the backend error message when Google login is rejected', async () => {
    mockFetch({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Invalid Google credential' } }, false);

    const result = await createTestStore().dispatch(
      authApi.endpoints.loginWithGoogle.initiate({ idToken: 'bad-token-1234' }),
    );

    expect(result).toMatchObject({
      error: { status: 401, data: { error: { message: 'Invalid Google credential' } } },
    });
  });
});

describe('authApi.login (email/password regression)', () => {
  it('does not send a restored stale token or refresh on credential rejection', async () => {
    const fetchMock = mockFetch({ success: false, error: { code: 'INVALID_CREDENTIALS' } }, false);
    const store = createTestStore();
    store.dispatch(restoreCredentials({ accessToken: 'expired', user: { id: 'u1', role: 'MODERATOR' } } as Parameters<typeof restoreCredentials>[0]));
    await store.dispatch(authApi.endpoints.login.initiate({ email: 'a@b.com', password: FAKE_PASSWORD }));
    const [request] = fetchMock.mock.calls[0] as [Request];
    expect(request.headers.has('authorization')).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('still POSTs email/password to /auth/login', async () => {
    const fetchMock = mockFetch({
      success: true,
      data: { twoFactorRequired: false, accessToken: 't', user: { id: 'u1' } },
    });

    await createTestStore().dispatch(
      authApi.endpoints.login.initiate({ email: 'a@b.com', password: FAKE_PASSWORD }),
    );

    const [request] = fetchMock.mock.calls[0] as [Request];
    expect(request.url).toMatch(/\/auth\/login$/);
    expect(JSON.parse(await request.text())).toEqual({ email: 'a@b.com', password: FAKE_PASSWORD });
  });
});

describe('refresh failure classification', () => {
  it('shares concurrent refresh and reports authentication rejection as null', async () => {
    const fetchMock = mockFetch({}, false);
    const a = refreshSessionChecked();
    const b = refreshSessionChecked();
    expect(a).toBe(b);
    expect(await a).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('does not misclassify a network outage as revoked credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(refreshSessionChecked()).rejects.toThrow('offline');
  });
  it('does not misclassify server failures as revoked credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(refreshSessionChecked()).rejects.toThrow('temporarily unavailable');
  });
});
