import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import authReducer, { clearCredentials, setCredentials } from '../store/authSlice';
import type { UserProfile } from '../types';
import { RoleGuard } from '../components/RoleGuard';

const mocks = vi.hoisted(() => ({ replace: vi.fn(), back: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, back: mocks.back, push: mocks.push }),
  usePathname: () => '/agency',
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('RoleGuard component', () => {
  it('redirects to login when unauthenticated', async () => {
    const store = configureStore({ reducer: { auth: authReducer } });
    store.dispatch(clearCredentials());
    render(
      <Provider store={store}>
        <RoleGuard allowedRoles={['AGENCY']} loginPath="/agency/login">
          <p>Protected Agency Content</p>
        </RoleGuard>
      </Provider>,
    );

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith('/agency/login');
    });
    expect(screen.queryByText('Protected Agency Content')).toBeNull();
  });

  it('renders custom 403 ForbiddenPage when showForbidden is true and role is mismatched', async () => {
    const store = configureStore({ reducer: { auth: authReducer } });
    store.dispatch(
      setCredentials({
        user: { id: 'u1', role: 'TRAVELER', fullName: 'Traveler Test' } as UserProfile,
        accessToken: 'token-123',
      }),
    );

    render(
      <Provider store={store}>
        <RoleGuard allowedRoles={['AGENCY']} showForbidden>
          <p>Protected Agency Content</p>
        </RoleGuard>
      </Provider>,
    );

    // Should render ForbiddenPage and NOT redirect to /home
    expect(await screen.findByText('Bạn không có quyền truy cập khu vực này')).toBeTruthy();
    expect(screen.queryByText('Protected Agency Content')).toBeNull();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('redirects to homeForRole when showForbidden is false (default) and role is mismatched', async () => {
    const store = configureStore({ reducer: { auth: authReducer } });
    store.dispatch(
      setCredentials({
        user: { id: 'u2', role: 'TRAVELER', fullName: 'Traveler Test' } as UserProfile,
        accessToken: 'token-123',
      }),
    );

    render(
      <Provider store={store}>
        <RoleGuard allowedRoles={['SUPER_ADMIN']}>
          <p>Super Admin Content</p>
        </RoleGuard>
      </Provider>,
    );

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith('/home');
    });
    expect(screen.queryByText('Super Admin Content')).toBeNull();
  });

  it('renders children when authenticated with allowed role', async () => {
    const store = configureStore({ reducer: { auth: authReducer } });
    store.dispatch(
      setCredentials({
        user: { id: 'u3', role: 'AGENCY', fullName: 'Agency Test' } as UserProfile,
        accessToken: 'token-123',
      }),
    );

    render(
      <Provider store={store}>
        <RoleGuard allowedRoles={['AGENCY']} showForbidden>
          <p>Protected Agency Content</p>
        </RoleGuard>
      </Provider>,
    );

    expect(await screen.findByText('Protected Agency Content')).toBeTruthy();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
