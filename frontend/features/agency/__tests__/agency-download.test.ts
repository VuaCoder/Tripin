import { configureStore } from '@reduxjs/toolkit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseApi } from '@/store/api/baseApi';
import authReducer, { setCredentials } from '@/features/auth/store/authSlice';
import { bookingApi } from '@/features/booking/api/bookingApi';
import type { SessionData } from '@/features/auth/types';
import { identityIsolation } from '@/store/api/identityIsolation';

const stores: ReturnType<typeof makeStore>[] = [];
function makeStore() {
  return configureStore({ reducer: { auth: authReducer, [baseApi.reducerPath]: baseApi.reducer }, middleware: (defaults) => defaults().concat(identityIsolation, baseApi.middleware) });
}
const session = { accessToken: 'fresh-token', user: { id: 'a1', role: 'AGENCY', permissions: ['agency:export-customers'] } } as SessionData;
const pdfResponse = () => new Response('%PDF-1.7\ncustomer rows\n%%EOF', { headers: { 'content-type': 'application/pdf' } });
function setup(...responses: Response[]) {
  const fetchMock = vi.fn();
  responses.forEach((response) => fetchMock.mockResolvedValueOnce(response));
  vi.stubGlobal('fetch', fetchMock);
  const create = vi.fn(() => 'blob:test-download');
  const revoke = vi.fn();
  const NativeUrl = URL;
  vi.stubGlobal('URL', class extends NativeUrl { static createObjectURL = create; static revokeObjectURL = revoke; });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  const store = makeStore(); stores.push(store);
  store.dispatch(setCredentials(session));
  return { fetchMock, store, create, revoke, click };
}

afterEach(() => { stores.splice(0).forEach((store) => store.dispatch(baseApi.util.resetApiState())); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Agency customer PDF download', () => {
  it('clears private Agency booking cache when a different account signs in', async () => {
    const { store } = setup(Response.json({ success: true, data: [{ id: 'private-booking-a' }], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }));
    await store.dispatch(bookingApi.endpoints.getAgencyBookings.initiate({}, { subscribe: false }));
    expect(bookingApi.endpoints.getAgencyBookings.select({})(store.getState()).data?.items[0]?.id).toBe('private-booking-a');
    store.dispatch(setCredentials({ ...session, user: { ...session.user, id: 'agency-b' } }));
    expect(bookingApi.endpoints.getAgencyBookings.select({})(store.getState()).data).toBeUndefined();
  });
  it('downloads a complete PDF with bearer auth, sends only departureId and returns serializable metadata', async () => {
    const { store, fetchMock, create, click } = setup(pdfResponse());
    const result = await store.dispatch(bookingApi.endpoints.downloadAgencyCustomers.initiate({ tourId: 'tour-1', departureId: 'dep-2' }));
    expect(result).toEqual({ data: { downloaded: true } });
    expect(create).toHaveBeenCalledOnce(); expect(click).toHaveBeenCalledOnce();
    const request = fetchMock.mock.calls[0]![0] as Request;
    expect(request.url).toMatch(/\/agency\/tours\/tour-1\/customers.pdf\?departureId=dep-2$/);
    expect(request.url).not.toContain('token');
    expect(request.headers.get('authorization')).toBe('Bearer fresh-token');
    expect(request.cache).toBe('no-store');
    expect(Object.values(store.getState().api.mutations)[0]?.data).toEqual({ downloaded: true });
  });

  it.each([403, 404, 409])('does not download an API error (%s)', async (status) => {
    const { store, click, create } = setup(Response.json({ success: false, error: { code: 'DENIED', message: 'Not accessible' } }, { status }));
    const result = await store.dispatch(bookingApi.endpoints.downloadAgencyCustomers.initiate({ tourId: 'foreign' }));
    expect(result).toHaveProperty('error.status', status);
    expect(click).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled();
  });

  it('refuses JSON disguised as a successful file response', async () => {
    const { store, click } = setup(Response.json({ success: true, data: {} }));
    const result = await store.dispatch(bookingApi.endpoints.downloadAgencyCustomers.initiate({ tourId: 'tour-1' }));
    expect(result).toHaveProperty('error');
    expect(click).not.toHaveBeenCalled();
  });

  it('refreshes an expired session then retries the PDF without putting credentials in its URL', async () => {
    const { store, fetchMock, click } = setup(Response.json({ error: { code: 'TOKEN_INVALID' } }, { status: 401 }), Response.json({ success: true, data: session }), pdfResponse());
    const result = await store.dispatch(bookingApi.endpoints.downloadAgencyCustomers.initiate({ tourId: 'tour-1' }));
    expect(result).toHaveProperty('data.downloaded', true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1]![0])).toContain('/auth/refresh');
    expect(click).toHaveBeenCalledOnce();
  });

  it('does not start a download when the network fails', async () => {
    const { store, fetchMock, click } = setup();
    fetchMock.mockRejectedValue(new TypeError('Network failed'));
    expect(await store.dispatch(bookingApi.endpoints.downloadAgencyCustomers.initiate({ tourId: 'tour-1' }))).toHaveProperty('error');
    expect(click).not.toHaveBeenCalled();
  });
});
