import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixtures = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: any[]) => void>,
  dispatch: vi.fn(), disconnect: vi.fn(), removeAllListeners: vi.fn(), connect: vi.fn(),
  refresh: vi.fn(), io: vi.fn(),
  auth: { user: { id: 'agency-1' }, accessToken: 'token-1' },
}));
vi.mock('socket.io-client', () => ({ io: fixtures.io }));
vi.mock('@/store/hooks', () => ({ useAppDispatch: () => fixtures.dispatch, useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: fixtures.auth }) }));
vi.mock('@/features/auth/store/authSlice', () => ({ selectUser: (state: any) => state.auth.user, selectAccessToken: (state: any) => state.auth.accessToken, setCredentials: (payload: unknown) => ({ type: 'credentials', payload }) }));
vi.mock('@/store/api/baseApi', () => ({
  refreshSession: fixtures.refresh,
  baseApi: {
    injectEndpoints: () => ({ useAgencyUnreadQuery: () => ({ data: 4 }) }),
    util: { invalidateTags: (tags: unknown) => ({ type: 'invalidate', tags }) },
  },
}));
import { useAgencyNotifications } from '../notifications';

describe('Agency realtime notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks(); fixtures.handlers = {};
    fixtures.io.mockImplementation(() => ({ on: (event: string, handler: (...args: any[]) => void) => { fixtures.handlers[event] = handler; }, disconnect: fixtures.disconnect, removeAllListeners: fixtures.removeAllListeners, connect: fixtures.connect, connected: false }));
  });
  afterEach(cleanup);
  it('authenticates without putting tokens in the URL and refreshes the inbox on push/reconnect', () => {
    const { result, unmount } = renderHook(() => useAgencyNotifications());
    expect(fixtures.io).toHaveBeenCalledWith('http://localhost:3001', { auth: { token: 'token-1' }, withCredentials: true });
    act(() => fixtures.handlers.connect());
    expect(result.current.connected).toBe(true);
    act(() => fixtures.handlers['notification:new']({ id: 'notification-1', title: 'Booking mới' }));
    expect(result.current.latest).toBe('Booking mới');
    expect(fixtures.dispatch).toHaveBeenCalledTimes(2);
    act(() => fixtures.handlers.disconnect());
    expect(result.current.connected).toBe(false);
    unmount();
    expect(fixtures.disconnect).toHaveBeenCalledOnce();
    expect(fixtures.removeAllListeners).toHaveBeenCalledOnce();
  });
  it('refreshes an expired token only for the same account', async () => {
    fixtures.refresh.mockResolvedValue({ user: { id: 'agency-1' }, accessToken: 'new-token' });
    renderHook(() => useAgencyNotifications());
    await act(async () => { await fixtures.handlers.connect_error(new Error('TOKEN_INVALID')); });
    expect(fixtures.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'credentials' }));
  });
  it('does not apply a refresh for another user or after unmount', async () => {
    let resolve!: (value: unknown) => void;
    fixtures.refresh.mockReturnValue(new Promise((done) => { resolve = done; }));
    const { unmount } = renderHook(() => useAgencyNotifications());
    act(() => { void fixtures.handlers.connect_error(new Error('UNAUTHENTICATED')); });
    unmount();
    await act(async () => { resolve({ user: { id: 'other-user' }, accessToken: 'other-token' }); });
    expect(fixtures.dispatch).not.toHaveBeenCalled();
  });
});
