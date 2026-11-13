import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PERSISTED_ROLES } from '@travel-platform/constants';
import authReducer, { setCredentials, clearCredentials } from '@/features/auth/store/authSlice';
import { baseApi } from '@/store/api/baseApi';
import type { UserProfile } from '@/features/auth/types';
import { homeForRole } from '@/features/auth/utils/roles';
const mocks = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, push: mocks.push }),
  usePathname: () => '/super-admin',
}));
import SuperAdminLayout from '@/app/super-admin/layout';

function createTestStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
      [baseApi.reducerPath]: baseApi.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('Super Admin layout access', () => {
  it.each(PERSISTED_ROLES)('only renders protected children for the correct role (%s)', async (role) => {
    const store = createTestStore();
    store.dispatch(setCredentials({ user: { id: 'actor', role } as UserProfile, accessToken: 'token' }));
    render(<Provider store={store}><SuperAdminLayout><p>Private admin content</p></SuperAdminLayout></Provider>);
    if (role === 'SUPER_ADMIN') expect(screen.getByText('Private admin content')).toBeTruthy();
    else { expect(screen.queryByText('Private admin content')).toBeNull(); await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(homeForRole(role))); }
  });
  it('does not mount protected content before auth bootstrap or after logout', async () => {
    const store = createTestStore();
    const { rerender } = render(<Provider store={store}><SuperAdminLayout><p>Private admin content</p></SuperAdminLayout></Provider>);
    expect(screen.queryByText('Private admin content')).toBeNull();
    store.dispatch(clearCredentials());
    rerender(<Provider store={store}><SuperAdminLayout><p>Private admin content</p></SuperAdminLayout></Provider>);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/login'));
    expect(screen.queryByText('Private admin content')).toBeNull();
  });
});
