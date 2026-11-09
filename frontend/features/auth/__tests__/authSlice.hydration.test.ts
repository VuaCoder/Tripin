import { afterEach, describe, expect, it, vi } from 'vitest';

describe('auth hydration', () => {
  afterEach(() => {
    localStorage.removeItem('tripri_auth_session');
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
    expect(initial).toEqual({ user: null, accessToken: null, status: 'idle' });
    expect(JSON.parse(localStorage.getItem('tripri_auth_session')!)).toEqual(session);

    // The bootstrap can still restore credentials once hydration has finished.
    expect(reducer(initial, setCredentials(session as Parameters<typeof setCredentials>[0])))
      .toEqual({ ...session, status: 'authenticated' });
  });
});
