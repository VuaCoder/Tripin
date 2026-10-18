import { configureStore } from '@reduxjs/toolkit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseApi } from '@/store/api/baseApi';
import { identityIsolation } from '@/store/api/identityIsolation';
import authReducer, {
  clearCredentials,
  setCredentials,
} from '@/features/auth/store/authSlice';
import type { UserProfile } from '@/features/auth/types';
import { subscriptionsApi } from '../api/subscriptionsApi';
import { earningsApi } from '../api/earningsApi';
import { earning, meta, plan, subscription } from './finance.fixtures';
import { earningsDateRange } from '../utils/finance';

const response = (data: unknown, status = 200) => {
  const res = {
    ok: status < 400,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => JSON.stringify(data),
    json: async () => data,
    clone: () => res,
  };
  return res;
};
const stores: ReturnType<typeof makeStore>[] = [];
function makeStore() {
  const store = configureStore({
    reducer: { auth: authReducer, [baseApi.reducerPath]: baseApi.reducer },
    middleware: (getDefault) =>
      getDefault().concat(identityIsolation, baseApi.middleware),
  });
  return store;
}
const setup = () => {
  const store = makeStore();
  stores.push(store);
  return store;
};
const login = (id: string) =>
  setCredentials({
    accessToken: `${id}-token`,
    user: { id, role: 'TOUR_GUIDE' } as UserProfile,
  });
afterEach(() => {
  stores.forEach((store) => store.dispatch(baseApi.util.resetApiState()));
  stores.length = 0;
  vi.unstubAllGlobals();
});

describe('Guide finance contracts and identity isolation', () => {
  it('refreshes an expired Guide token and retries earnings with the new token', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        response({ error: { code: 'TOKEN_INVALID' } }, 401),
      )
      .mockResolvedValueOnce(
        response({
          success: true,
          data: {
            user: { id: 'A', role: 'TOUR_GUIDE' },
            accessToken: 'renewed-A',
          },
        }),
      )
      .mockResolvedValueOnce(response({ data: [earning], meta }));
    vi.stubGlobal('fetch', fetch);
    const store = setup();
    store.dispatch(login('A'));
    const result = await store.dispatch(
      earningsApi.endpoints.getMyEarnings.initiate({}),
    );
    expect(result.data?.items).toEqual([earning]);
    expect(String(fetch.mock.calls[1][0])).toContain('/auth/refresh');
    expect(
      (fetch.mock.calls[2][0] as Request).headers.get('authorization'),
    ).toBe('Bearer renewed-A');
  });

  it('clears private data when token refresh fails', async () => {
    vi.stubGlobal('window', {
      location: { pathname: '/login', href: '/login' },
    });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          response({ error: { code: 'TOKEN_INVALID' } }, 401),
        )
        .mockResolvedValueOnce(response({}, 401)),
    );
    const store = setup();
    store.dispatch(login('A'));
    await store.dispatch(earningsApi.endpoints.getMyEarnings.initiate({}));
    expect(store.getState().auth.user).toBeNull();
    expect(
      earningsApi.endpoints.getMyEarnings.select({})(store.getState()).data,
    ).toBeUndefined();
  });

  it.each([true, false])(
    'ignores a late token refresh from A after switching to B (success=%s)',
    async (success) => {
      let resolveRefresh!: (value: ReturnType<typeof response>) => void;
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(
          response({ error: { code: 'TOKEN_INVALID' } }, 401),
        )
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveRefresh = resolve;
            }),
        );
      vi.stubGlobal('fetch', fetch);
      const store = setup();
      store.dispatch(login('A'));
      const request = store.dispatch(
        earningsApi.endpoints.getMyEarnings.initiate({}),
      );
      await vi.waitFor(() => expect(resolveRefresh).toBeTypeOf('function'));
      store.dispatch(login('B'));
      resolveRefresh(
        success
          ? response({
              success: true,
              data: { user: { id: 'A' }, accessToken: 'renewed-A' },
            })
          : response({}, 401),
      );
      await request;
      expect(store.getState().auth.user?.id).toBe('B');
      expect(store.getState().auth.accessToken).toBe('B-token');
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(
        earningsApi.endpoints.getMyEarnings.select({})(store.getState()).data,
      ).toBeUndefined();
    },
  );
  it('loads plans, current and paginated history with the server envelopes', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ data: [plan] }))
      .mockResolvedValueOnce(
        response({ data: { active: false, subscription: null } }),
      )
      .mockResolvedValueOnce(response({ data: [subscription], meta }));
    vi.stubGlobal('fetch', fetch);
    const store = setup();
    store.dispatch(login('A'));
    expect(
      (
        await store.dispatch(
          subscriptionsApi.endpoints.getSubscriptionPlans.initiate(),
        )
      ).data,
    ).toEqual([plan]);
    expect(
      (
        await store.dispatch(
          subscriptionsApi.endpoints.getCurrentSubscription.initiate(),
        )
      ).data?.active,
    ).toBe(false);
    expect(
      (
        await store.dispatch(
          subscriptionsApi.endpoints.getMySubscriptions.initiate({
            page: 2,
            limit: 5,
          }),
        )
      ).data,
    ).toEqual({ items: [subscription], meta });
    expect((fetch.mock.calls[2][0] as Request).url).toMatch(
      /\/subscriptions\/me\?page=2&limit=5$/,
    );
    expect(
      (fetch.mock.calls[2][0] as Request).headers.get('authorization'),
    ).toBe('Bearer A-token');
  });

  it('posts only planId and unwrap rejects API failure', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        response({ error: { message: 'Gateway failed' } }, 502),
      );
    vi.stubGlobal('fetch', fetch);
    const store = setup();
    store.dispatch(login('A'));
    await expect(
      store
        .dispatch(subscriptionsApi.endpoints.subscribeToPlan.initiate(plan.id))
        .unwrap(),
    ).rejects.toMatchObject({ status: 502 });
    const request = fetch.mock.calls[0][0] as Request;
    expect(request.method).toBe('POST');
    expect(await request.json()).toEqual({ planId: plan.id });
  });

  it('uses the same inclusive Vietnam dates for list and summary, with independent pagination', async () => {
    const summary = { totalAmount: 500000, count: 2, byMonth: [] };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ data: [earning], meta }))
      .mockResolvedValueOnce(response({ data: summary }));
    vi.stubGlobal('fetch', fetch);
    const range = earningsDateRange('2026-10-01', '2026-10-01');
    expect(range).toEqual({
      from: '2026-09-30T17:00:00.000Z',
      to: '2026-10-01T16:59:59.999Z',
    });
    const store = setup();
    expect(
      (
        await store.dispatch(
          earningsApi.endpoints.getMyEarnings.initiate({
            ...range,
            page: 2,
            limit: 1,
          }),
        )
      ).data,
    ).toEqual({ items: [earning], meta });
    expect(
      (
        await store.dispatch(
          earningsApi.endpoints.getMyEarningsSummary.initiate(range),
        )
      ).data,
    ).toEqual(summary);
    const urls = fetch.mock.calls.map(
      ([request]) => new URL((request as Request).url),
    );
    urls.forEach((url) => {
      expect(url.searchParams.get('from')).toBe(range.from);
      expect(url.searchParams.get('to')).toBe(range.to);
      expect(url.searchParams.has('guideId')).toBe(false);
    });
    expect(urls[1].searchParams.has('page')).toBe(false);
  });

  it('clears all private finance queries at an account switch and ignores an A request finishing after B logs in', async () => {
    let resolveLate!: (value: ReturnType<typeof response>) => void;
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ data: [subscription], meta }))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveLate = resolve;
          }),
      );
    vi.stubGlobal('fetch', fetch);
    const store = setup();
    store.dispatch(login('A'));
    await store.dispatch(
      subscriptionsApi.endpoints.getMySubscriptions.initiate({}),
    );
    const late = store.dispatch(
      earningsApi.endpoints.getMyEarnings.initiate({}),
    );
    await vi.waitFor(() => expect(resolveLate).toBeTypeOf('function'));
    store.dispatch(login('B'));
    expect(
      subscriptionsApi.endpoints.getMySubscriptions.select({})(store.getState())
        .data,
    ).toBeUndefined();
    resolveLate(response({ data: [earning], meta }));
    await late;
    expect(
      earningsApi.endpoints.getMyEarnings.select({})(store.getState()).data,
    ).toBeUndefined();
    fetch.mockResolvedValue(
      response({ data: [], meta: { ...meta, total: 0 } }),
    );
    const result = await store.dispatch(
      earningsApi.endpoints.getMyEarnings.initiate({}),
    );
    expect(result.data?.items).toEqual([]);
    expect(
      (fetch.mock.calls.at(-1)![0] as Request).headers.get('authorization'),
    ).toBe('Bearer B-token');
    store.dispatch(clearCredentials());
    expect(
      earningsApi.endpoints.getMyEarnings.select({})(store.getState()).data,
    ).toBeUndefined();
  });
});
