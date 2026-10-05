import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const gid = vi.hoisted(() => ({
  initialize: vi.fn(),
  renderButton: vi.fn(),
}));
const loadGoogleIdentity = vi.hoisted(() => vi.fn());
const loginWithGoogle = vi.hoisted(() => vi.fn());

vi.mock('../utils/googleIdentity', () => ({
  GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
  loadGoogleIdentity,
}));
vi.mock('../api/authApi', () => ({ authApi: { loginWithGoogle } }));

import { useGoogleLogin } from '../hooks/useGoogleLogin';

const sessionData = {
  twoFactorRequired: false as const,
  accessToken: 'access',
  user: { id: 'u1', email: 'a@b.com', fullName: 'A B', role: 'TRAVELER' as const, status: 'ACTIVE' as const, createdAt: '' },
};

/** Mounts the hook, attaches a host element for Google's button and waits for the SDK to be ready. */
async function setup(handlers: { onSuccess?: (d: unknown) => void; onError?: (m: string) => void } = {}) {
  const hook = renderHook(() => {
    const value = useGoogleLogin(handlers as never);
    // Stand in for the DOM node the component would attach before effects run.
    value.buttonHost.current ??= document.createElement('div');
    return value;
  });
  await waitFor(() => expect(hook.result.current.isReady).toBe(true));
  const credentialCallback = gid.initialize.mock.calls.at(-1)![0].callback as (r: { credential?: string }) => Promise<void>;
  return { ...hook, credentialCallback };
}

beforeEach(() => {
  gid.initialize.mockReset();
  gid.renderButton.mockReset();
  loginWithGoogle.mockReset();
  loadGoogleIdentity.mockReset();
  loadGoogleIdentity.mockResolvedValue(gid);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useGoogleLogin', () => {
  it('initialises Google Identity Services with the client id and renders its button', async () => {
    await setup();

    expect(gid.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: 'test-client-id.apps.googleusercontent.com' }),
    );
    expect(gid.renderButton).toHaveBeenCalled();
  });

  it('exchanges the Google credential with the backend and reports success', async () => {
    const onSuccess = vi.fn();
    loginWithGoogle.mockResolvedValue({ success: true, data: sessionData });
    const { credentialCallback, result } = await setup({ onSuccess });

    await act(async () => {
      await credentialCallback({ credential: 'google-id-token' });
    });

    expect(loginWithGoogle).toHaveBeenCalledWith({ idToken: 'google-id-token' });
    expect(onSuccess).toHaveBeenCalledWith(sessionData);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('surfaces a backend rejection (OAuth failure) through error and onError', async () => {
    const onError = vi.fn();
    loginWithGoogle.mockRejectedValue(new Error('Invalid Google credential'));
    const { credentialCallback, result } = await setup({ onError });

    await act(async () => {
      await credentialCallback({ credential: 'forged' });
    });

    expect(result.current.error).toBe('Invalid Google credential');
    expect(onError).toHaveBeenCalledWith('Invalid Google credential');
    expect(result.current.isLoading).toBe(false);
  });

  it('reports an error when Google returns no credential, without calling the backend', async () => {
    const onError = vi.fn();
    const { credentialCallback, result } = await setup({ onError });

    await act(async () => {
      await credentialCallback({});
    });

    expect(loginWithGoogle).not.toHaveBeenCalled();
    expect(result.current.error).toBeTruthy();
    expect(onError).toHaveBeenCalled();
  });

  it('reports an error when the Google SDK fails to load', async () => {
    loadGoogleIdentity.mockRejectedValue(new Error('network'));
    const onError = vi.fn();
    const { result } = renderHook(() => useGoogleLogin({ onError }));

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.isReady).toBe(false);
    expect(onError).toHaveBeenCalled();
  });

  it('shows a cancel notice when the popup is closed without a credential', async () => {
    const { result } = await setup();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    act(() => result.current.markPopupOpening());
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(result.current.notice).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1600);
    });

    expect(result.current.notice).toMatch(/hủy/);
    expect(result.current.error).toBeNull();
  });

  it('does not show a cancel notice when a credential arrives after focus returns', async () => {
    loginWithGoogle.mockResolvedValue({ success: true, data: sessionData });
    const { result, credentialCallback } = await setup();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    act(() => result.current.markPopupOpening());
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await act(async () => {
      await credentialCallback({ credential: 'google-id-token' });
    });
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.notice).toBeNull();
  });
});
