import { configureStore } from '@reduxjs/toolkit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseApi } from '@/store/api/baseApi';
import { identityIsolation } from '@/store/api/identityIsolation';
import authReducer, { setCredentials } from '@/features/auth/store/authSlice';
import type { UserProfile } from '@/features/auth/types';
import { premiumApi } from '../api';
const stores: ReturnType<typeof makeStore>[] = [];
function makeStore() {
  return configureStore({
    reducer: { auth: authReducer, [baseApi.reducerPath]: baseApi.reducer },
    middleware: (get) => get().concat(identityIsolation, baseApi.middleware),
  });
}
function setup() {
  const store = makeStore();
  stores.push(store);
  return store;
}
const login = (id: string, role: UserProfile['role'] = 'TRAVELER') =>
  setCredentials({
    accessToken: `${id}-${role}`,
    user: { id, role } as UserProfile,
  });
const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
afterEach(() => {
  stores.forEach((s) => s.dispatch(baseApi.util.resetApiState()));
  stores.length = 0;
  vi.unstubAllGlobals();
});
describe('Premium API and identity isolation', () => {
  it('preserves pagination metadata and sends the requested history page', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(reply({ data: [], meta: { page: 2, totalPages: 3 } }));
    vi.stubGlobal('fetch', fetch);
    const store = setup();
    store.dispatch(login('a'));
    const result = await store
      .dispatch(
        premiumApi.endpoints.premiumHistory.initiate({ userId: 'a', page: 2 }),
      )
      .unwrap();
    expect(result.meta).toEqual({ page: 2, totalPages: 3 });
    expect((fetch.mock.calls[0]![0] as Request).url).toContain('page=2');
  });
  it('sends only a plan ID to checkout', async () => {
    const fetch = vi.fn().mockResolvedValue(
      reply({
        data: { checkout: { checkoutUrl: 'https://pay.payos.vn/test' } },
      }),
    );
    vi.stubGlobal('fetch', fetch);
    const store = setup();
    store.dispatch(login('a'));
    await store
      .dispatch(premiumApi.endpoints.premiumSubscribe.initiate('plan-a'))
      .unwrap();
    const request = fetch.mock.calls[0]![0] as Request;
    expect(request.url).toContain('/premium/subscribe');
    expect(request.method).toBe('POST');
    expect(await request.json()).toEqual({ planId: 'plan-a' });
  });
  it('discards an old membership response arriving after an account switch', async () => {
    let complete!: (response: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            complete = resolve;
          }),
      ),
    );
    const store = setup();
    store.dispatch(login('a'));
    const pending = store.dispatch(
      premiumApi.endpoints.myPremium.initiate('a:TRAVELER'),
    );
    await vi.waitFor(() => expect(complete).toBeDefined());
    store.dispatch(login('b'));
    complete(
      reply({
        data: { active: true, endsAt: '2026-11-25T00:00:00Z', expired: false },
      }),
    );
    await pending;
    expect(
      premiumApi.endpoints.myPremium.select('a:TRAVELER')(store.getState())
        .data,
    ).toBeUndefined();
    expect(
      premiumApi.endpoints.myPremium.select('b:TRAVELER')(store.getState())
        .data,
    ).toBeUndefined();
  });
  it('clears old-role entitlements even when the account ID stays the same', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        reply({
          data: {
            active: true,
            endsAt: '2026-11-25T00:00:00Z',
            expired: false,
          },
        }),
      ),
    );
    const store = setup();
    store.dispatch(login('a'));
    await store
      .dispatch(premiumApi.endpoints.myPremium.initiate('a:TRAVELER'))
      .unwrap();
    store.dispatch(login('a', 'TOUR_GUIDE'));
    expect(
      premiumApi.endpoints.myPremium.select('a:TRAVELER')(store.getState())
        .data,
    ).toBeUndefined();
    expect(store.getState().auth.user?.role).toBe('TOUR_GUIDE');
  });
  it('does not restore an old role from a delayed refresh response', async () => {
    let finishRefresh!: (response: Response) => void;
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply({ error: { code: 'TOKEN_INVALID' } }, 401))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finishRefresh = resolve;
          }),
      );
    vi.stubGlobal('fetch', fetch);
    const store = setup();
    store.dispatch(login('a'));
    const pending = store.dispatch(
      premiumApi.endpoints.myPremium.initiate('a:TRAVELER'),
    );
    await vi.waitFor(() => expect(finishRefresh).toBeDefined());
    store.dispatch(login('a', 'TOUR_GUIDE'));
    finishRefresh(
      reply({
        success: true,
        data: {
          accessToken: 'old-traveler',
          user: { id: 'a', role: 'TRAVELER' },
        },
      }),
    );
    await pending;
    expect(store.getState().auth.user?.role).toBe('TOUR_GUIDE');
    expect(store.getState().auth.accessToken).toBe('a-TOUR_GUIDE');
  });
});
