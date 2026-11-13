import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import authReducer, { setCredentials } from '@/features/auth/store/authSlice';
import type { UserProfile } from '@/features/auth/types';
import ConversationLayout from '@/app/conversations/layout';

const mocks = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/conversations',
}));

const signedIn = (role: UserProfile['role']) => {
  const store = configureStore({ reducer: { auth: authReducer } });
  store.dispatch(setCredentials({ user: { id: 'u1', role, fullName: 'Test' } as UserProfile, accessToken: 'token' }));
  return store;
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ConversationLayout', () => {
  it('lets an agency into the shared inbox', async () => {
    render(
      <Provider store={signedIn('AGENCY')}>
        <ConversationLayout><p>Hộp thư dùng chung</p></ConversationLayout>
      </Provider>,
    );
    expect(await screen.findByText('Hộp thư dùng chung')).toBeTruthy();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('still keeps roles outside the inbox out', async () => {
    render(
      <Provider store={signedIn('MODERATOR')}>
        <ConversationLayout><p>Hộp thư dùng chung</p></ConversationLayout>
      </Provider>,
    );
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/moderator'));
    expect(screen.queryByText('Hộp thư dùng chung')).toBeNull();
  });
});
