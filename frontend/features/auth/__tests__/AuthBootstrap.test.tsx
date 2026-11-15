import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthBootstrap } from '../components/AuthBootstrap';

const harness = vi.hoisted(() => ({
  auth: { user: null as null | { id: string }, accessToken: null as string | null },
  dispatch: vi.fn(), refresh: vi.fn(),
}));
vi.mock('@/store/hooks', () => ({ useAppDispatch: () => harness.dispatch }));
vi.mock('@/store', () => ({ store: { getState: () => ({ auth: harness.auth }) } }));
vi.mock('@/store/api/baseApi', () => ({
  refreshSessionChecked: () => harness.refresh(),
  baseApi: { util: { resetApiState: () => ({ type: 'api/reset' }) } },
}));

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  harness.auth = { user: null, accessToken: null };
  harness.dispatch.mockReset(); harness.refresh.mockReset();
});
afterEach(cleanup);

describe('AuthBootstrap refresh lifecycle', () => {
  it('clears restored expired credentials on definitive refresh rejection', async () => {
    harness.auth = { user: { id: 'old' }, accessToken: 'expired' };
    harness.refresh.mockResolvedValue(null);
    render(<AuthBootstrap />);
    await waitFor(() => expect(harness.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'auth/clearCredentials' })));
    expect(harness.dispatch).toHaveBeenCalledWith({ type: 'api/reset' });
  });
  it('does not destroy a persisted identity during an outage', async () => {
    harness.auth = { user: { id: 'old' }, accessToken: 'expired' };
    harness.refresh.mockRejectedValue(new Error('offline'));
    render(<AuthBootstrap />);
    await waitFor(() => expect(harness.refresh).toHaveBeenCalled());
    expect(harness.dispatch).not.toHaveBeenCalled();
  });
  it('does not leave a guest indefinitely idle during an outage', async () => {
    harness.refresh.mockRejectedValue(new Error('offline'));
    render(<AuthBootstrap />);
    await waitFor(() => expect(harness.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'auth/clearCredentials' })));
  });
  it('does not overwrite login that completes while bootstrap is pending', async () => {
    let resolve!: (session: unknown) => void;
    harness.refresh.mockReturnValue(new Promise(done => { resolve = done; }));
    render(<AuthBootstrap />);
    harness.auth = { user: { id: 'new' }, accessToken: 'new-token' };
    resolve({ user: { id: 'old' }, accessToken: 'old-token' });
    await new Promise(done => setTimeout(done, 0));
    expect(harness.dispatch).not.toHaveBeenCalled();
  });
});
