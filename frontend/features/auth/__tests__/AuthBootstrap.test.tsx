import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthBootstrap } from '../components/AuthBootstrap';
import reducer, { clearCredentials } from '../store/authSlice';

const harness = vi.hoisted(() => ({
  auth: {} as any,
  dispatch: vi.fn(), refresh: vi.fn(), verify: vi.fn(),
}));
vi.mock('@/store/hooks', () => ({ useAppDispatch: () => harness.dispatch }));
vi.mock('@/store', () => ({ store: { getState: () => ({ auth: harness.auth }) } }));
vi.mock('@/store/api/baseApi', () => ({
  refreshSessionChecked: () => harness.refresh(),
  verifyStoredSessionChecked: (token: string) => harness.verify(token),
  baseApi: { util: { resetApiState: () => ({ type: 'api/reset' }) } },
}));

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  harness.auth = reducer(undefined, { type: 'init' });
  harness.dispatch.mockReset(); harness.refresh.mockReset(); harness.verify.mockReset();
  harness.dispatch.mockImplementation(action => { harness.auth = reducer(harness.auth, action); });
});
afterEach(cleanup);

describe('AuthBootstrap refresh lifecycle', () => {
  it('clears restored expired credentials on definitive refresh rejection', async () => {
    harness.auth = { ...harness.auth, user: { id: 'old' }, accessToken: 'expired' };
    harness.refresh.mockResolvedValue(null);
    render(<AuthBootstrap />);
    await waitFor(() => expect(harness.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'auth/clearCredentials' })));
    expect(harness.dispatch).toHaveBeenCalledWith({ type: 'api/reset' });
  });
  it('does not destroy a persisted identity during an outage', async () => {
    harness.auth = { ...harness.auth, user: { id: 'old' }, accessToken: 'expired' };
    harness.refresh.mockRejectedValue(new Error('offline'));
    render(<AuthBootstrap />);
    await waitFor(() => expect(harness.refresh).toHaveBeenCalled());
    await waitFor(() => expect(harness.auth.bootstrapError).toBeTruthy());
    expect(harness.auth.user.id).toBe('old');
    expect(harness.dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'auth/clearCredentials' }));
  });
  it('offers session recovery for a guest during an outage without assuming logout', async () => {
    harness.refresh.mockRejectedValue(new Error('offline'));
    render(<AuthBootstrap />);
    await waitFor(() => expect(harness.auth.bootstrapError).toBeTruthy());
  });
  it('does not overwrite login that completes while bootstrap is pending', async () => {
    let resolve!: (session: unknown) => void;
    harness.refresh.mockReturnValue(new Promise(done => { resolve = done; }));
    render(<AuthBootstrap />);
    harness.auth = { ...harness.auth, status: 'authenticated', user: { id: 'new' }, accessToken: 'new-token' };
    resolve({ user: { id: 'old' }, accessToken: 'old-token' });
    await new Promise(done => setTimeout(done, 0));
    expect(harness.auth.user.id).toBe('new');
    expect(harness.dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'auth/setCredentials' }));
  });
  it('does not restore a cookie session after explicit logout while bootstrap is pending', async () => {
    let resolve!: (session: unknown) => void;
    harness.refresh.mockReturnValue(new Promise(done => { resolve = done; }));
    render(<AuthBootstrap />);
    harness.dispatch(clearCredentials());
    resolve({ user: { id: 'old' }, accessToken: 'old-token' });
    await new Promise(done => setTimeout(done, 0));
    expect(harness.auth.status).toBe('unauthenticated');
    expect(harness.auth.user).toBeNull();
  });
  it('verifies a fresh remembered token and reloads effective permissions before redirecting', async () => {
    const token = `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;
    localStorage.setItem('tripri_auth_session', JSON.stringify({ user: { id: 'old', role: 'MODERATOR' }, accessToken: token }));
    harness.verify.mockResolvedValue({ user: { id: 'old', role: 'MODERATOR', permissions: ['tour-completion:view'] }, accessToken: token });
    render(<AuthBootstrap />);
    await waitFor(() => expect(harness.auth.status).toBe('authenticated'));
    expect(harness.verify).toHaveBeenCalledWith(token);
    expect(harness.refresh).not.toHaveBeenCalled();
    expect(harness.auth.user.permissions).toEqual(['tour-completion:view']);
  });
  it('restores a session using only the HttpOnly refresh cookie after browser storage was cleared', async () => {
    harness.refresh.mockResolvedValue({ user: { id: 'cookie-user', role: 'TRAVELER' }, accessToken: 'fresh' });
    render(<AuthBootstrap />);
    await waitFor(() => expect(harness.auth.status).toBe('authenticated'));
    expect(harness.auth.user.id).toBe('cookie-user');
  });
  it('refreshes in the background without unmounting protected forms on focus', async () => {
    harness.refresh.mockResolvedValue({ user: { id: 'u', role: 'TRAVELER' }, accessToken: 'expired' });
    render(<AuthBootstrap />);
    await waitFor(() => expect(harness.auth.status).toBe('authenticated'));
    const starts = harness.dispatch.mock.calls.filter(([a]) => a.type === 'auth/beginSessionRestore').length;
    harness.refresh.mockRejectedValue(new Error('temporary outage'));
    fireEvent(window, new Event('focus'));
    await waitFor(() => expect(harness.refresh).toHaveBeenCalledTimes(2));
    expect(harness.auth.status).toBe('authenticated');
    expect(harness.dispatch.mock.calls.filter(([a]) => a.type === 'auth/beginSessionRestore')).toHaveLength(starts);
  });
});
