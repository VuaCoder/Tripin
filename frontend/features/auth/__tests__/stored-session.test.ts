import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyStoredSessionChecked } from '@/store/api/baseApi';
afterEach(() => vi.unstubAllGlobals());
describe('stored session verification', () => {
  it('checks /users/me with the stored token without rotating a fresh refresh cookie', async () => {
    const fetch = vi.fn(async (_url: unknown, _init?: unknown) => Response.json({ success: true, data: { id: 'u', role: 'MODERATOR', permissions: ['tour-completion:view'] } }));
    vi.stubGlobal('fetch', fetch);
    expect(await verifyStoredSessionChecked('fresh')).toMatchObject({ accessToken: 'fresh', user: { id: 'u' } });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[0]).toMatch(/\/users\/me$/);
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include', headers: { Authorization: 'Bearer fresh' } });
  });
  it('refreshes an invalid access token using cookies and returns null only if refresh is rejected', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ success: false }, { status: 401 })).mockResolvedValueOnce(Response.json({ success: false }, { status: 401 }));
    vi.stubGlobal('fetch', fetch);
    expect(await verifyStoredSessionChecked('expired')).toBeNull();
    expect(fetch.mock.calls[1]?.[0]).toMatch(/\/auth\/refresh$/);
    expect(fetch.mock.calls[1]?.[1]).toMatchObject({ method: 'POST', credentials: 'include' });
  });
  it.each([403, 500, 503])('does not treat HTTP %i as a definitive logout', async status => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: false }, { status })));
    await expect(verifyStoredSessionChecked('token')).rejects.toThrow();
  });
});
