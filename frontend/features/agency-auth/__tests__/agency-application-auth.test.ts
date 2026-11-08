import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '@/store';
import { setCredentials, clearCredentials } from '@/features/auth/store/authSlice';
import type { UserProfile } from '@/features/auth/types';
import { agencyAuthApi } from '../api';
const user = { id: 'agency', role: 'AGENCY', permissions: [] } as unknown as UserProfile;
const envelope = (data: unknown, status = 200) => Response.json({ success: status === 200, data }, { status });
beforeEach(() => { store.dispatch(clearCredentials()); });
afterEach(() => { vi.unstubAllGlobals(); store.dispatch(clearCredentials()); });
describe('agency application ownership credentials', () => {
  it('keeps expired access headers off credential login and refresh requests', async () => {
    store.dispatch(setCredentials({ user, accessToken: 'expired-access' }));
    const fetch = vi.fn(async () => envelope({})); vi.stubGlobal('fetch', fetch);
    await agencyAuthApi.login({ email: 'agency@example.com', password: 'Passw0rd!' });
    await agencyAuthApi.refreshSession();
    for (const [, init] of fetch.mock.calls as unknown as [string, RequestInit][]) expect(new Headers(init.headers).has('authorization')).toBe(false);
  });
  it('restores the own session before reading an email-addressed application after reload', async () => {
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/refresh')) return envelope({ accessToken: 'restored-access', user });
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer restored-access');
      return envelope({ id: 'agency', email: 'agency@example.com' });
    }); vi.stubGlobal('fetch', fetch);
    const response = await agencyAuthApi.getApplicationDetails({ email: 'agency@example.com' });
    expect(response.id).toBe('agency'); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('uses a scoped token without forwarding a different signed-in identity', async () => {
    store.dispatch(setCredentials({ user: { ...user, id: 'other-agency' }, accessToken: 'other-access' }));
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => { expect(new Headers(init?.headers).has('authorization')).toBe(false); return envelope({ email: 'onboarding@example.com' }); }); vi.stubGlobal('fetch', fetch);
    await agencyAuthApi.getApplicationStatus({ token: 'scoped-onboarding-token' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
