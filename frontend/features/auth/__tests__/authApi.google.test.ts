import { afterEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '../api/authApi';

const mockFetch = (body: unknown, ok = true) => {
  const fetchMock = vi.fn().mockResolvedValue({ ok, json: async () => body });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('authApi.loginWithGoogle', () => {
  it('POSTs the ID token to /auth/google with credentials so the refresh cookie is stored', async () => {
    const fetchMock = mockFetch({ success: true, data: { twoFactorRequired: false, accessToken: 't' } });

    const result = await authApi.loginWithGoogle({ idToken: 'id-token-123456' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/auth\/google$/);
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(JSON.parse(init.body)).toEqual({ idToken: 'id-token-123456' });
    expect(result.success).toBe(true);
  });

  it('throws the backend error message when Google login is rejected', async () => {
    mockFetch({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Invalid Google credential' } }, false);

    await expect(authApi.loginWithGoogle({ idToken: 'bad-token-1234' })).rejects.toThrow('Invalid Google credential');
  });

  it('falls back to a default message when the error body has none', async () => {
    mockFetch({}, false);

    await expect(authApi.loginWithGoogle({ idToken: 'bad-token-1234' })).rejects.toThrow('Đăng nhập Google thất bại');
  });
});

describe('authApi.login (email/password regression)', () => {
  it('still POSTs credential/password to /auth/login', async () => {
    const fetchMock = mockFetch({ success: true, data: { twoFactorRequired: false } });

    await authApi.login({ credential: 'a@b.com', password: 'Passw0rdX' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/auth\/login$/);
    expect(JSON.parse(init.body)).toEqual({ email: 'a@b.com', password: 'Passw0rdX' });
  });
});
