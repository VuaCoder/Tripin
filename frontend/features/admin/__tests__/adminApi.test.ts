import { configureStore } from '@reduxjs/toolkit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import authReducer, { clearCredentials, setCredentials } from '@/features/auth/store/authSlice';
import type { UserProfile } from '@/features/auth/types';
import { baseApi } from '@/store/api/baseApi';
import { identityIsolation } from '@/store/api/identityIsolation';
import { adminApi } from '../api/adminApi';
import { dashboard, meta, policy, promotion, user } from './fixtures';

const stores: ReturnType<typeof makeStore>[] = [];
function makeStore() {
  return configureStore({ reducer: { auth: authReducer, [baseApi.reducerPath]: baseApi.reducer }, middleware: (g) => g().concat(identityIsolation, baseApi.middleware) });
}
function setup() {
  const store = makeStore(); stores.push(store);
  store.dispatch(setCredentials({ user: { id: 'admin', role: 'SUPER_ADMIN' } as UserProfile, accessToken: 'admin-token' }));
  return store;
}
function response(body: unknown, status = 200) { return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }); }
afterEach(() => { stores.forEach((s) => s.dispatch(baseApi.util.resetApiState())); stores.length = 0; vi.unstubAllGlobals(); });

describe('ADMIN-01 HTTP contracts', () => {
  it('loads dashboard and filtered paginated users/promotions with bearer authentication', async () => {
    const fetch = vi.fn().mockImplementationOnce(async () => response({ success: true, data: dashboard }))
      .mockImplementationOnce(async () => response({ success: true, data: [user], meta }))
      .mockImplementationOnce(async () => response({ success: true, data: [promotion], meta }))
      .mockImplementationOnce(async () => response({ success: true, data: promotion }));
    vi.stubGlobal('fetch', fetch); const store = setup();
    expect((await store.dispatch(adminApi.endpoints.getAdminDashboard.initiate())).data).toEqual(dashboard);
    expect((await store.dispatch(adminApi.endpoints.getAdminUsers.initiate({ page: 2, limit: 10, q: '(VIP)', role: 'TRAVELER', status: 'ACTIVE' }))).data).toEqual({ items: [user], meta });
    expect((await store.dispatch(adminApi.endpoints.getAdminPromotions.initiate({ page: 1, limit: 10, isActive: false }))).data?.items).toEqual([promotion]);
    expect((await store.dispatch(adminApi.endpoints.getAdminPromotion.initiate('promo'))).data).toEqual(promotion);
    const requests = fetch.mock.calls.map(([r]) => r as Request);
    expect(new URL(requests[1].url).searchParams.get('q')).toBe('(VIP)');
    expect(new URL(requests[2].url).searchParams.get('isActive')).toBe('false');
    expect(requests[3].url).toMatch(/\/admin\/promotions\/promo$/);
    for (const req of requests) expect(req.headers.get('authorization')).toBe('Bearer admin-token');
  });

  it('writes commission, policy, access and promotions with exact payloads, including extraPermissions=[]', async () => {
    const fetch = vi.fn().mockImplementation(async () => response({ success: true, data: user }));
    vi.stubGlobal('fetch', fetch); const store = setup();
    await store.dispatch(adminApi.endpoints.assignAdminAccess.initiate({ id: 'target', role: 'MODERATOR', extraPermissions: [] })).unwrap();
    await store.dispatch(adminApi.endpoints.setAdminCommission.initiate(12.5)).unwrap();
    const body = { title: policy.title, content: policy.content, params: policy.params };
    await store.dispatch(adminApi.endpoints.setAdminPolicy.initiate({ key: 'cancellation', body })).unwrap();
    const create = { code: 'NEW10', title: 'New discount', discountType: 'PERCENT' as const, discountValue: 10, startsAt: promotion.startsAt, endsAt: promotion.endsAt };
    await store.dispatch(adminApi.endpoints.createAdminPromotion.initiate(create)).unwrap();
    await store.dispatch(adminApi.endpoints.updateAdminPromotion.initiate({ id: 'promo', patch: { isActive: false } })).unwrap();
    const requests = fetch.mock.calls.map(([r]) => r as Request);
    expect(requests.map((r) => r.method)).toEqual(['PATCH', 'PUT', 'PUT', 'POST', 'PATCH']);
    expect(await requests[0].json()).toEqual({ role: 'MODERATOR', extraPermissions: [] });
    expect(await requests[1].json()).toEqual({ ratePercent: 12.5 });
    expect(await requests[2].json()).toEqual(body);
    expect(requests[2].url).toMatch(/\/admin\/policies\/cancellation$/);
    expect(await requests[3].json()).toEqual(create);
    expect(await requests[4].json()).toEqual({ isActive: false });
  });

  it('uses array envelopes for categories/policies and handles category DELETE 204', async () => {
    const category = { id: 'cat', name: 'Beach', slug: 'beach', sortOrder: 0, isActive: true };
    const fetch = vi.fn().mockImplementationOnce(async () => response({ success: true, data: [category] }))
      .mockImplementationOnce(async () => response({ success: true, data: [policy] }))
      .mockImplementationOnce(async () => response({ success: true, data: { ratePercent: 0, rateBps: 0 } }))
      .mockImplementationOnce(async () => response({ success: true, data: category }))
      .mockImplementationOnce(async () => response({ success: true, data: category }))
      .mockImplementationOnce(async () => response(null, 204));
    vi.stubGlobal('fetch', fetch); const store = setup();
    expect((await store.dispatch(adminApi.endpoints.getAdminCategories.initiate(undefined, { subscribe: false }))).data).toEqual([category]);
    expect((await store.dispatch(adminApi.endpoints.getAdminPolicies.initiate(undefined, { subscribe: false }))).data).toEqual([policy]);
    expect((await store.dispatch(adminApi.endpoints.getAdminCommission.initiate(undefined, { subscribe: false }))).data?.rateBps).toBe(0);
    await store.dispatch(adminApi.endpoints.createAdminCategory.initiate({ name: 'Beach', sortOrder: 0 })).unwrap();
    await store.dispatch(adminApi.endpoints.updateAdminCategory.initiate({ id: 'cat', patch: { isActive: true } })).unwrap();
    await expect(store.dispatch(adminApi.endpoints.deactivateAdminCategory.initiate('cat')).unwrap()).resolves.toBeNull();
    expect((fetch.mock.calls.at(-1)![0] as Request).method).toBe('DELETE');
    expect((fetch.mock.calls[1][0] as Request).url).toMatch(/\/policies$/);
  });

  it.each([400, 403, 409, 500])('rejects failed mutation %s and preserves the confirmed cached commission', async (status) => {
    const fetch = vi.fn().mockImplementationOnce(async () => response({ success: true, data: { ratePercent: 10, rateBps: 1000 } }))
      .mockImplementationOnce(async () => response({ success: false, error: { code: 'FAILED', message: 'Rejected' } }, status));
    vi.stubGlobal('fetch', fetch); const store = setup();
    await store.dispatch(adminApi.endpoints.getAdminCommission.initiate());
    await expect(store.dispatch(adminApi.endpoints.setAdminCommission.initiate(50)).unwrap()).rejects.toMatchObject({ status });
    expect(adminApi.endpoints.getAdminCommission.select()(store.getState()).data?.ratePercent).toBe(10);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('drops private admin data on account switch and logout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => response({ success: true, data: dashboard })));
    const store = setup(); await store.dispatch(adminApi.endpoints.getAdminDashboard.initiate());
    store.dispatch(setCredentials({ user: { id: 'traveler', role: 'TRAVELER' } as UserProfile, accessToken: 'traveler-token' }));
    expect(adminApi.endpoints.getAdminDashboard.select()(store.getState()).data).toBeUndefined();
    store.dispatch(clearCredentials());
    expect(Object.keys(store.getState().api.queries)).toHaveLength(0);
  });

  it('preserves saved commission on a network failure without retrying a mutation', async () => {
    const fetch = vi.fn().mockImplementationOnce(async () => response({ success: true, data: { ratePercent: 10, rateBps: 1000 } }))
      .mockRejectedValueOnce(new TypeError('Network disconnected'));
    vi.stubGlobal('fetch', fetch); const store = setup();
    await store.dispatch(adminApi.endpoints.getAdminCommission.initiate());
    await expect(store.dispatch(adminApi.endpoints.setAdminCommission.initiate(50)).unwrap()).rejects.toMatchObject({ status: 'FETCH_ERROR' });
    expect(adminApi.endpoints.getAdminCommission.select()(store.getState()).data?.rateBps).toBe(1000);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
