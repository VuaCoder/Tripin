import { configureStore } from '@reduxjs/toolkit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import authReducer, { setCredentials } from '@/features/auth/store/authSlice';
import type { SessionData } from '@/features/auth/types';
import { baseApi } from '@/store/api/baseApi';
import { identityIsolation } from '@/store/api/identityIsolation';
import { toursApi } from '@/features/tours/api/toursApi';
import { shouldRefetchAgencyDashboard } from '../dashboardCache';

afterEach(() => vi.unstubAllGlobals());

describe('Agency dashboard snapshot freshness', () => {
  const now = Date.parse('2026-10-17T10:00:00.000Z');

  it('reuses a snapshot within the backend cache window', () => {
    expect(shouldRefetchAgencyDashboard(new Date(now - 29_999).toISOString(), now)).toBe(false);
  });

  it('refetches an expired, missing, invalid or future snapshot', () => {
    expect(shouldRefetchAgencyDashboard(new Date(now - 30_000).toISOString(), now)).toBe(true);
    expect(shouldRefetchAgencyDashboard(undefined, now)).toBe(true);
    expect(shouldRefetchAgencyDashboard('invalid', now)).toBe(true);
    expect(shouldRefetchAgencyDashboard(new Date(now + 10_000).toISOString(), now)).toBe(true);
  });

  it('reuses the RTK cache on a quick return, refetches an expired snapshot, and clears it on account switch', async () => {
    const generatedAt = new Date().toISOString();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ data: { generatedAt } }))
      .mockResolvedValueOnce(Response.json({ data: { generatedAt: new Date(Date.now() + 30_000).toISOString() } }));
    vi.stubGlobal('fetch', fetchMock);
    const store = configureStore({
      reducer: { auth: authReducer, [baseApi.reducerPath]: baseApi.reducer },
      middleware: (defaults) => defaults().concat(identityIsolation, baseApi.middleware),
    });
    const session = { accessToken: 'token-a', user: { id: 'agency-a', role: 'AGENCY', permissions: ['agency:dashboard'] } } as SessionData;
    store.dispatch(setCredentials(session));
    const selectDashboard = toursApi.endpoints.getAgencyDashboard.select();

    const first = store.dispatch(toursApi.endpoints.getAgencyDashboard.initiate());
    await first;
    first.unsubscribe();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(selectDashboard(store.getState()).data?.generatedAt).toBe(generatedAt);

    const quickReturn = store.dispatch(toursApi.endpoints.getAgencyDashboard.initiate(undefined, {
      forceRefetch: shouldRefetchAgencyDashboard(generatedAt, Date.now() + 1_000),
    }));
    await quickReturn;
    quickReturn.unsubscribe();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const expiredReturn = store.dispatch(toursApi.endpoints.getAgencyDashboard.initiate(undefined, {
      forceRefetch: shouldRefetchAgencyDashboard(generatedAt, Date.now() + 30_000),
    }));
    await expiredReturn;
    expiredReturn.unsubscribe();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    store.dispatch(setCredentials({ ...session, user: { ...session.user, id: 'agency-b' } }));
    expect(selectDashboard(store.getState()).data).toBeUndefined();
    store.dispatch(baseApi.util.resetApiState());
  });
});
