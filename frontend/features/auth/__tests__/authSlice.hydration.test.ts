import { afterEach, describe, expect, it, vi } from 'vitest';

describe('auth hydration', () => {
  afterEach(() => {
    localStorage.removeItem('tripri_auth_session');
    sessionStorage.removeItem('tripri_auth_session');
    vi.resetModules();
  });

  it('starts with the server state even when the browser has a saved session', async () => {
    const session = {
      user: { id: 'traveler-1', role: 'TRAVELER', fullName: 'Traveler' },
      accessToken: 'saved-token',
    };
    localStorage.setItem('tripri_auth_session', JSON.stringify(session));
    vi.resetModules();
    const { default: reducer, setCredentials } = await import('../store/authSlice');

    const initial = reducer(undefined, { type: '@@INIT' });
    expect(initial).toMatchObject({ user: null, accessToken: null, status: 'idle', agencies: [], activeAgencyId: null, membershipsReady: false });
    expect(JSON.parse(localStorage.getItem('tripri_auth_session')!)).toEqual(session);

    // The bootstrap can still restore credentials once hydration has finished.
    expect(reducer(initial, setCredentials(session as Parameters<typeof setCredentials>[0])))
      .toMatchObject({ ...session, status: 'authenticated', agencies: [], membershipsReady: false });
  });

  it('persists to localStorage when rememberMe is true and sessionStorage when rememberMe is false', async () => {
    const session = {
      user: { id: 'traveler-1', role: 'TRAVELER', fullName: 'Traveler' } as any,
      accessToken: 'saved-token',
    };
    const { default: reducer, setCredentials, clearCredentials } = await import('../store/authSlice');

    let state = reducer(undefined, setCredentials({ ...session, rememberMe: false }));
    expect(sessionStorage.getItem('tripri_auth_session')).toBeTruthy();
    expect(localStorage.getItem('tripri_auth_session')).toBeNull();

    state = reducer(state, setCredentials({ ...session, rememberMe: true }));
    expect(localStorage.getItem('tripri_auth_session')).toBeTruthy();
    expect(sessionStorage.getItem('tripri_auth_session')).toBeNull();

    reducer(state, clearCredentials());
    expect(localStorage.getItem('tripri_auth_session')).toBeNull();
    expect(sessionStorage.getItem('tripri_auth_session')).toBeNull();
  });

  it('does not invalidate personal queries when a legacy same-user token is refreshed', async () => {
    const { default: reducer, setCredentials } = await import('../store/authSlice');
    const session = { user: { id: 'guide-1', role: 'TOUR_GUIDE' } as any, accessToken: 'old-token' };
    const signedIn = reducer(undefined, setCredentials(session));
    const refreshed = reducer(signedIn, setCredentials({ ...session, accessToken: 'new-token' }));
    expect(refreshed.agencyEpoch).toBe(signedIn.agencyEpoch);
    expect(refreshed.accessToken).toBe('new-token');
    expect(refreshed.membershipsReady).toBe(false);
  });

  it('still invalidates agency authority if a refresh no longer supplies memberships', async () => {
    const { default: reducer, selectActiveAgency, setCredentials } = await import('../store/authSlice');
    const session = { user: { id: 'traveler-1', role: 'TRAVELER' } as any, accessToken: 'old-token', agencies: [{ agencyId: 'agency-1', memberId: 'member-1', memberRole: 'OWNER' as const, companyName: 'Agency', verificationStatus: 'VERIFIED' as const, permissions: ['agency:context-view'] }] };
    const signedIn = reducer(undefined, setCredentials(session));
    const refreshed = reducer(signedIn, setCredentials({ user: session.user, accessToken: 'new-token' }));
    expect(refreshed.agencyEpoch).toBeGreaterThan(signedIn.agencyEpoch);
    expect(selectActiveAgency({ auth: refreshed } as any)).toBeNull();
  });
});
