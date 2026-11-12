import { configureStore } from '@reduxjs/toolkit';
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import authReducer, { clearCredentials, restoreCredentials, selectActiveAgency, selectAgency, setAgencyMemberships, setCredentials } from '@/features/auth/store/authSlice';
import type { AgencyMembership, SessionData } from '@/features/auth/types';
import { baseApi } from '@/store/api/baseApi';
import { identityIsolation } from '@/store/api/identityIsolation';
import { membershipFixture } from '@/test/agencySession';
import { AgencySelector } from '../components/AgencySelector';
import { useAgencyPermission } from '../AgencyCommon';
import { getLocalNotifications, saveLocalNotifications, setLocalNotificationScope } from '../localNotifications';

const a = membershipFixture({ permissions: ['agency:context-view', 'tour:update-own', 'agency:finance-view'] });
const b = membershipFixture({ agencyId: '22222222-2222-4222-8222-222222222222', memberId: 'member-2', companyName: 'Agency B', memberRole: 'ACCOUNTANT', permissions: ['agency:context-view', 'agency:finance-view'] });
const session = (agencies: AgencyMembership[] = [a]): SessionData => ({ accessToken: 'test-access', user: { id: 'actor-traveler', role: 'TRAVELER', permissions: [] } as any, agencies });
const probe = baseApi.injectEndpoints({ endpoints: build => ({
  foundationAgencyProbe: build.query<{ data: string }, void>({ query: () => '/agency/context' }),
  foundationPersonalProbe: build.query<unknown, void>({ query: () => '/users/me' }),
  foundationAuthProbe: build.mutation<unknown, void>({ query: () => ({ url: '/auth/agency/login', method: 'POST', body: {} }) }),
}) });
const stores: ReturnType<typeof makeStore>[] = [];
function makeStore() { return configureStore({ reducer: { auth: authReducer, [baseApi.reducerPath]: baseApi.reducer }, middleware: defaults => defaults().concat(identityIsolation, baseApi.middleware) }); }
function setup(agencies = [a]) { const store = makeStore(); stores.push(store); store.dispatch(setCredentials(session(agencies))); return store; }
afterEach(() => { cleanup(); stores.splice(0).forEach(s => s.dispatch(baseApi.util.resetApiState())); localStorage.clear(); sessionStorage.clear(); setLocalNotificationScope(null, null); vi.unstubAllGlobals(); });

describe('Foundation session and selection', () => {
  it('keeps a Traveler role and chooses the only membership, never actor ID', () => {
    const store = setup();
    expect(store.getState().auth.user?.role).toBe('TRAVELER');
    expect(selectActiveAgency(store.getState())?.agencyId).toBe(a.agencyId);
    expect(a.agencyId).not.toBe(store.getState().auth.user?.id);
  });
  it('requires an explicit selection for multiple memberships', () => {
    const store = setup([a,b]);
    expect(selectActiveAgency(store.getState())).toBeNull();
    render(<Provider store={store}><AgencySelector /></Provider>);
    fireEvent.change(screen.getByRole('combobox', { name: 'Doanh nghiệp đang truy cập' }), { target: { value: b.agencyId } });
    expect(selectActiveAgency(store.getState())?.memberRole).toBe('ACCOUNTANT');
  });
  it('ignores an unknown agency selector', () => {
    const store = setup(); store.dispatch(selectAgency('foreign'));
    expect(selectActiveAgency(store.getState())?.agencyId).toBe(a.agencyId);
  });
  it('preserves a valid selected agency through session refresh/OTP completion', () => {
    const store = setup([a,b]); store.dispatch(selectAgency(b.agencyId));
    store.dispatch(setCredentials({ ...session([a,b]), accessToken: 'rotated' }));
    expect(selectActiveAgency(store.getState())?.agencyId).toBe(b.agencyId);
  });
  it('preserves personal access when all memberships are removed', () => {
    const store = setup(); store.dispatch(setAgencyMemberships({ userId: 'actor-traveler', agencies: [] }));
    expect(selectActiveAgency(store.getState())).toBeNull();
    expect(store.getState().auth.user?.role).toBe('TRAVELER');
    expect(store.getState().auth.accessToken).toBe('test-access');
  });
  it('does not apply membership responses belonging to another account', () => {
    const store = setup(); store.dispatch(setAgencyMemberships({ userId: 'someone-else', agencies: [b] }));
    expect(selectActiveAgency(store.getState())?.agencyId).toBe(a.agencyId);
  });
  it('restores only identity and selection hints, not stored membership authority', () => {
    const store = makeStore(); stores.push(store);
    store.dispatch(restoreCredentials({ ...session([a,b]), activeAgencyId: b.agencyId }));
    expect(selectActiveAgency(store.getState())).toBeNull();
    expect(store.getState().auth.membershipsReady).toBe(false);
    store.dispatch(setAgencyMemberships({ userId: 'actor-traveler', agencies: [a,b] }));
    expect(selectActiveAgency(store.getState())?.agencyId).toBe(b.agencyId);
  });
  it('fails closed for old sessions with no agencies field', () => {
    const store = setup(); store.dispatch(setCredentials({ accessToken: 'legacy', user: session().user }));
    expect(selectActiveAgency(store.getState())).toBeNull();
    expect(store.getState().auth.membershipsReady).toBe(false);
  });
  it('clears membership authority and persisted selection on logout', () => {
    const store = setup(); store.dispatch(clearCredentials());
    expect(store.getState().auth.agencies).toEqual([]);
    expect(store.getState().auth.activeAgencyId).toBeNull();
    expect(localStorage.getItem('tripri_auth_session')).toBeNull();
  });
  it.each(['OWNER','MANAGER','STAFF','ACCOUNTANT'] as const)('uses server permissions, not global role defaults (%s)', memberRole => {
    const membership = membershipFixture({ memberRole, permissions: memberRole === 'ACCOUNTANT' ? ['agency:finance-view'] : memberRole === 'STAFF' ? ['tour:update-own'] : ['tour:update-own','agency:finance-view'] });
    const store = setup([membership]);
    const { result } = renderHook(() => [useAgencyPermission('agency:finance-view'), useAgencyPermission('tour:update-own')], { wrapper: ({children}) => <Provider store={store}>{children}</Provider> });
    expect(result.current).toEqual([membership.permissions.includes('agency:finance-view'), membership.permissions.includes('tour:update-own')]);
  });
});

describe('Tenant HTTP and cache isolation', () => {
  it('attaches the membership agency ID to Agency requests, not personal or login requests', async () => {
    const fetchMock = vi.fn(async (_request: Request) => Response.json({ data: 'ok' })); vi.stubGlobal('fetch', fetchMock);
    const store = setup();
    await store.dispatch(probe.endpoints.foundationAgencyProbe.initiate());
    await store.dispatch(probe.endpoints.foundationPersonalProbe.initiate());
    await store.dispatch(probe.endpoints.foundationAuthProbe.initiate());
    const requests = fetchMock.mock.calls.map(call => call[0] as unknown as Request);
    expect(requests[0].headers.get('X-Agency-Id')).toBe(a.agencyId);
    expect(requests[1].headers.get('X-Agency-Id')).toBeNull();
    expect(requests[2].headers.get('X-Agency-Id')).toBeNull();
  });
  it('does not send an Agency request without a selection', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); const store = setup([a,b]);
    const result = await store.dispatch(probe.endpoints.foundationAgencyProbe.initiate());
    expect(result.error).toMatchObject({ status: 403 }); expect(fetchMock).not.toHaveBeenCalled();
  });
  it('clears the previous tenant cache and fetches the new tenant with its own header', async () => {
    const fetchMock = vi.fn(async (request: Request) => Response.json({ data: request.headers.get('X-Agency-Id') })); vi.stubGlobal('fetch', fetchMock);
    const store = setup([a,b]); store.dispatch(selectAgency(a.agencyId));
    await store.dispatch(probe.endpoints.foundationAgencyProbe.initiate(undefined, { subscribe: false }));
    expect(probe.endpoints.foundationAgencyProbe.select()(store.getState()).data?.data).toBe(a.agencyId);
    store.dispatch(selectAgency(b.agencyId));
    expect(probe.endpoints.foundationAgencyProbe.select()(store.getState()).data).toBeUndefined();
    await store.dispatch(probe.endpoints.foundationAgencyProbe.initiate(undefined, { subscribe: false }));
    expect(probe.endpoints.foundationAgencyProbe.select()(store.getState()).data?.data).toBe(b.agencyId);
  });
  it('rejects late responses even after an A → B → A switch', async () => {
    let finish!: (response: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })); vi.stubGlobal('fetch', fetchMock);
    const store = setup([a,b]); store.dispatch(selectAgency(a.agencyId));
    const pending = store.dispatch(probe.endpoints.foundationAgencyProbe.initiate());
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    store.dispatch(selectAgency(b.agencyId)); store.dispatch(selectAgency(a.agencyId));
    finish(Response.json({ data: 'private-old-result' })); await pending;
    expect(probe.endpoints.foundationAgencyProbe.select()(store.getState()).data).toBeUndefined();
  });
  it('does not restore suspended membership on a 401 refresh', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ error: { code: 'TOKEN_INVALID' } }, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ success: true, data: session([]) })); vi.stubGlobal('fetch', fetchMock);
    const store = setup(); await store.dispatch(probe.endpoints.foundationAgencyProbe.initiate());
    expect(selectActiveAgency(store.getState())).toBeNull();
    expect(store.getState().auth.user?.id).toBe('actor-traveler'); expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('does not apply an old refresh after selecting another agency', async () => {
    let finish!: (response: Response) => void;
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ error: { code: 'TOKEN_INVALID' } }, { status: 401 }))
      .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
    vi.stubGlobal('fetch', fetchMock);
    const store = setup([a,b]); store.dispatch(selectAgency(a.agencyId));
    const pending = store.dispatch(probe.endpoints.foundationAgencyProbe.initiate());
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    store.dispatch(selectAgency(b.agencyId));
    finish(Response.json({ success: true, data: { ...session([a,b]), accessToken: 'late-rotated-token' } }));
    await pending;
    expect(selectActiveAgency(store.getState())?.agencyId).toBe(b.agencyId);
    expect(store.getState().auth.accessToken).toBe('test-access'); expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('refreshes memberships on 403 without logging out the personal user', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ error: { code: 'FORBIDDEN' } }, { status: 403 }))
      .mockResolvedValueOnce(Response.json({ data: [] })); vi.stubGlobal('fetch', fetchMock);
    const store = setup(); await store.dispatch(probe.endpoints.foundationAgencyProbe.initiate());
    expect(store.getState().auth.user?.id).toBe('actor-traveler'); expect(selectActiveAgency(store.getState())).toBeNull();
  });
  it('does not treat a feature-level 403 as membership revocation', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ error: { code: 'FORBIDDEN' } }, { status: 403 }))
      .mockResolvedValueOnce(Response.json({ data: [a] })); vi.stubGlobal('fetch', fetchMock);
    const store = setup(); const result = await store.dispatch(probe.endpoints.foundationAgencyProbe.initiate());
    expect(result.error).toMatchObject({ status: 403 }); expect(selectActiveAgency(store.getState())?.agencyId).toBe(a.agencyId);
  });
  it('clears caches on membership permission changes without a user switch', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: 'secret' })));
    const store = setup(); await store.dispatch(probe.endpoints.foundationAgencyProbe.initiate(undefined, { subscribe: false }));
    store.dispatch(setAgencyMemberships({ userId: 'actor-traveler', agencies: [{ ...a, permissions: [] }] }));
    expect(probe.endpoints.foundationAgencyProbe.select()(store.getState()).data).toBeUndefined();
  });
});

describe('Browser notification isolation', () => {
  it('namespaces local rows by actor and agency and ignores unscoped history', () => {
    localStorage.setItem('tripri_local_notifications', JSON.stringify([{ id: 'unscoped' }]));
    const store = setup([a,b]); store.dispatch(selectAgency(a.agencyId));
    expect(getLocalNotifications()).toEqual([]);
    saveLocalNotifications([{ id: 'only-a' } as any]);
    store.dispatch(selectAgency(b.agencyId)); expect(getLocalNotifications()).toEqual([]);
    store.dispatch(selectAgency(a.agencyId)); expect(getLocalNotifications()[0]?.id).toBe('only-a');
    store.dispatch(clearCredentials()); expect(getLocalNotifications()).toEqual([]);
    expect(localStorage.getItem('tripri_local_notifications')).not.toBeNull();
  });
});
