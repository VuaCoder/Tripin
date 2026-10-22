import { configureStore } from '@reduxjs/toolkit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import authReducer, { setCredentials } from '@/features/auth/store/authSlice';
import type { SessionData } from '@/features/auth/types';
import { baseApi } from '@/store/api/baseApi';
import { identityIsolation } from '@/store/api/identityIsolation';
import { toursApi } from '@/features/tours/api/toursApi';

afterEach(() => vi.unstubAllGlobals());

describe('Booking tour picker and Tour Management cache', () => {
  it('deduplicates an in-flight page and reuses it across screens until the Agency changes', async () => {
    const fetchMock = vi.fn(async () => Response.json({
      data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 1 },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const store = configureStore({
      reducer: { auth: authReducer, [baseApi.reducerPath]: baseApi.reducer },
      middleware: (defaults) => defaults().concat(identityIsolation, baseApi.middleware),
    });
    const session = { accessToken: 'token-a', user: { id: 'agency-a', role: 'AGENCY', permissions: ['tour:update-own'] } } as SessionData;
    store.dispatch(setCredentials(session));

    const picker = store.dispatch(toursApi.endpoints.getAgencyTours.initiate({ page: 1, limit: 12 }));
    const management = store.dispatch(toursApi.endpoints.getAgencyTours.initiate({ page: 1, limit: 12, status: undefined }));
    await Promise.all([picker, management]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    picker.unsubscribe();
    management.unsubscribe();

    const revisit = store.dispatch(toursApi.endpoints.getAgencyTours.initiate({ page: 1, limit: 12 }));
    await revisit;
    revisit.unsubscribe();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const searched = store.dispatch(toursApi.endpoints.getAgencyTours.initiate({ page: 1, limit: 12, q: 'Ha Long' }));
    await searched;
    searched.unsubscribe();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    store.dispatch(setCredentials({ ...session, user: { ...session.user, id: 'agency-b' } }));
    expect(toursApi.endpoints.getAgencyTours.select({ page: 1, limit: 12 })(store.getState()).data).toBeUndefined();
    store.dispatch(baseApi.util.resetApiState());
  });
});
