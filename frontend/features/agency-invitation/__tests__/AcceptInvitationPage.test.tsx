import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import authReducer, { setCredentials } from '@/features/auth/store/authSlice';
import type { SessionData } from '@/features/auth/types';
import { baseApi } from '@/store/api/baseApi';
import { identityIsolation } from '@/store/api/identityIsolation';
import { AcceptInvitationPage } from '../AcceptInvitationPage';

// Route context: /invitations/accept?token=...
const state = vi.hoisted(() => ({
  params: new URLSearchParams({ token: 'abc123' }),
  push: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/invitations/accept',
  useRouter: () => ({ push: state.push, replace: state.push }),
  useSearchParams: () => state.params,
}));
vi.mock('next/link', () => ({
  default: ({ href, children, className }: any) => (
    <a href={String(href)} className={className}>
      {children}
    </a>
  ),
}));

const ACCESS_URL = 'http://localhost:5240/api/v1';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Default invitation returned by the validate GET for a PENDING token.
const pendingInfo = { status: 'PENDING', email: 'invitee@example.com', role: 'ACCOUNTANT', expiresAt: '2099-12-31T00:00:00.000Z', agencyName: 'Du Lịch AB' };

function routeFetch(invite: unknown = pendingInfo, onAccept?: () => void) {
  return vi.fn((request: any) => {
    const url = typeof request === 'string' ? new URL(request, ACCESS_URL) : new URL(request.url, ACCESS_URL);
    if (url.pathname.endsWith('/agency-invitations/accept')) {
      onAccept?.();
      return json(invite);
    }
    if (url.pathname.includes('/agency-invitations/invitations/')) return json({ success: true, data: invite });
    return json({ success: false, data: null }, 404);
  });
}

function makeStore(session?: SessionData) {
  const store = configureStore({
    reducer: { auth: authReducer, [baseApi.reducerPath]: baseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(identityIsolation, baseApi.middleware),
  });
  if (session) store.dispatch(setCredentials(session));
  return store;
}

const authenticatedSession: SessionData = {
  accessToken: 'test-access',
  user: { id: 'u1', email: 'invitee@example.com', fullName: 'Invitee', role: 'TRAVELER', status: 'ACTIVE', permissions: [], twoFactorEnabled: false, createdAt: '' } as any,
  agencies: [],
};

const guest = () => makeStore();

afterEach(() => {
  cleanup();
  state.params = new URLSearchParams({ token: 'abc123' });
  state.push.mockClear();
  vi.unstubAllGlobals();
});

describe('AcceptInvitationPage', () => {
  it('shows a missing-token screen when the URL has no token', () => {
    state.params = new URLSearchParams();
    vi.stubGlobal('fetch', vi.fn());
    render(
      <Provider store={guest()}>
        <AcceptInvitationPage />
      </Provider>,
    );
    expect(screen.getByText('Liên kết không hợp lệ')).toBeTruthy();
  });

  it('renders invitation info (agency, role label, email) with a login CTA for a guest', async () => {
    vi.stubGlobal('fetch', routeFetch());
    render(
      <Provider store={guest()}>
        <AcceptInvitationPage />
      </Provider>,
    );

    expect((await screen.findAllByText('Du Lịch AB')).length).toBeGreaterThan(0);
    expect(screen.getByText('Kế toán')).toBeTruthy();
    expect(screen.getByText('invitee@example.com')).toBeTruthy();

    const loginLink = screen.getByRole('link', { name: /Đăng nhập để chấp nhận/ });
    expect(loginLink.getAttribute('href')).toBe(`/login?next=${encodeURIComponent('/invitations/accept?token=abc123')}`);
    expect(screen.queryByRole('button', { name: /Chấp nhận lời mời/ })).toBeNull();
  });

  it('accepts for an authenticated user and routes to /agency on success', async () => {
    const onAccept = vi.fn();
    vi.stubGlobal('fetch', routeFetch(pendingInfo, onAccept));
    render(
      <Provider store={makeStore(authenticatedSession)}>
        <AcceptInvitationPage />
      </Provider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Chấp nhận lời mời/ }));

    expect(await screen.findByText('Bạn đã gia nhập Du Lịch AB thành công')).toBeTruthy();
    expect(onAccept).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Vào quản trị/ }));
    expect(state.push).toHaveBeenCalledWith('/agency');
  });

  it('shows a dedicated EXPIRED screen', async () => {
    vi.stubGlobal('fetch', routeFetch({ ...pendingInfo, status: 'EXPIRED' }));
    render(
      <Provider store={guest()}>
        <AcceptInvitationPage />
      </Provider>,
    );
    expect(await screen.findByText('Lời mời đã hết hạn')).toBeTruthy();
  });

  it('shows a dedicated INVALID screen', async () => {
    vi.stubGlobal('fetch', routeFetch({ status: 'INVALID' }));
    render(
      <Provider store={guest()}>
        <AcceptInvitationPage />
      </Provider>,
    );
    expect(await screen.findByText('Lời mời không hợp lệ')).toBeTruthy();
  });

  it('shows a dedicated ALREADY-ACCEPTED screen with a login-to-admin action', async () => {
    vi.stubGlobal('fetch', routeFetch({ status: 'ACCEPTED', email: 'invitee@example.com', agencyName: 'Du Lịch AB' }));
    render(
      <Provider store={guest()}>
        <AcceptInvitationPage />
      </Provider>,
    );
    expect(await screen.findByText(/đã được chấp nhận/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Đăng nhập để vào quản trị/ }).getAttribute('href')).toBe(
      `/login?next=${encodeURIComponent('/invitations/accept?token=abc123')}`,
    );
  });
});
