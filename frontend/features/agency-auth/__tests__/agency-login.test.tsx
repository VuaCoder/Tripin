import { configureStore } from '@reduxjs/toolkit';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import authReducer, { clearCredentials } from '@/features/auth/store/authSlice';
import { baseApi } from '@/store/api/baseApi';
import { identityIsolation } from '@/store/api/identityIsolation';
import { PartnerAccountPage } from '../PartnerAccountPage';

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), params: new URLSearchParams() }));
vi.mock('next/navigation', () => ({ useRouter: () => nav, useSearchParams: () => nav.params }));
vi.mock('@/features/auth/components/GoogleLoginButton', () => ({ GoogleLoginButton: () => <button type="button">Tiếp tục với Google</button> }));
const session = { accessToken: 'test-token', user: { id: 'account-a', email: 'an@example.test', fullName: 'Nguyen Van An', role: 'TRAVELER', permissions: [] }, agencies: [] };
const stores: ReturnType<typeof createStore>[] = [];
function createStore() { return configureStore({ reducer: { auth: authReducer, [baseApi.reducerPath]: baseApi.reducer }, middleware: d => d().concat(identityIsolation, baseApi.middleware) }); }
function mount(mode: 'login' | 'register' = 'login') {
  const store = createStore(); store.dispatch(clearCredentials()); stores.push(store);
  render(<Provider store={store}><PartnerAccountPage mode={mode} /></Provider>);
  return store;
}
beforeEach(() => { nav.push.mockReset(); nav.replace.mockReset(); nav.params = new URLSearchParams(); });
afterEach(() => { cleanup(); stores.splice(0).forEach(s => s.dispatch(baseApi.util.resetApiState())); vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear(); });
function fillLogin() {
  fireEvent.change(screen.getByLabelText(/Email/), { target: { value: session.user.email } });
  fireEvent.change(screen.getByLabelText(/^Mật khẩu/), { target: { value: 'Passw0rdX' } });
}
describe('Partner account auth without an existing workplace', () => {
  it('uses common login and keeps a personal account with zero memberships signed in', async () => {
    const requests: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (req: Request) => { requests.push({ url: req.url, body: await req.json() }); return Response.json({ success: true, data: { ...session, twoFactorRequired: false } }); }));
    const store = mount(); fillLogin();
    fireEvent.click(screen.getByLabelText('Ghi nhớ đăng nhập'));
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/workplaces'));
    expect(requests[0].url).toMatch(/\/auth\/login$/);
    expect(requests[0].body.rememberMe).toBe(true);
    expect(store.getState().auth.user?.role).toBe('TRAVELER');
    expect(store.getState().auth.agencies).toEqual([]);
  });
  it('creates only the account and carries signup through OTP to workplace selection', async () => {
    const requests: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (req: Request) => { requests.push({ url: req.url, body: await req.json() }); return Response.json({ success: true, data: { email: session.user.email, otpExpiresInSeconds: 600 } }); }));
    const store = mount('register');
    fireEvent.change(screen.getByLabelText(/Họ và tên/), { target: { value: 'Nguyen Van An' } });
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: session.user.email } });
    fireEvent.change(screen.getByLabelText(/Số điện thoại/), { target: { value: '0901234567' } });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu/), { target: { value: 'Passw0rdX' } });
    fireEvent.change(screen.getByLabelText(/Xác nhận mật khẩu/), { target: { value: 'Passw0rdX' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));
    await waitFor(() => expect(nav.push).toHaveBeenCalled());
    const target = new URL(nav.push.mock.calls[0][0], 'https://local.test');
    expect(target.pathname).toBe('/verify-otp');
    expect(target.searchParams.get('next')).toBe('/workplaces');
    expect(requests).toHaveLength(1);
    expect(requests[0].body.role).toBe('TRAVELER');
    expect(requests[0].body).not.toHaveProperty('companyName');
    expect(store.getState().auth.status).toBe('unauthenticated');
  });
  it('keeps an invitation destination through a 2FA challenge without creating a session early', async () => {
    const next = '/agency/invitations/accept?token=' + 'a'.repeat(64); nav.params.set('next', next);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: true, data: { twoFactorRequired: true, email: session.user.email } })));
    const store = mount(); fillLogin(); fireEvent.click(screen.getByLabelText('Ghi nhớ đăng nhập'));
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    await waitFor(() => expect(nav.push).toHaveBeenCalled());
    const target = new URL(nav.push.mock.calls[0][0], 'https://local.test');
    expect(target.searchParams.get('next')).toBe(next);
    expect(target.searchParams.get('purpose')).toBe('LOGIN_2FA');
    expect(target.searchParams.get('rememberMe')).toBe('true');
    expect(store.getState().auth.status).toBe('unauthenticated');
  });
  it('does not navigate to auth again after a malicious or looping next target', async () => {
    nav.params.set('next', '/agency/login');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: true, data: { ...session, twoFactorRequired: false } })));
    mount(); fillLogin(); fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/workplaces'));
  });
  it('continues email verification without first requiring a business profile', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: false, error: { code: 'ACCOUNT_NOT_VERIFIED', message: 'Verify email' } }, { status: 403 })));
    const store = mount(); fillLogin(); fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    await waitFor(() => expect(nav.push).toHaveBeenCalled());
    const target = new URL(nav.push.mock.calls[0][0], 'https://local.test');
    expect(target.pathname).toBe('/verify-otp');
    expect(target.searchParams.get('purpose')).toBe('REGISTER');
    expect(target.searchParams.get('next')).toBe('/workplaces');
    expect(store.getState().auth.status).toBe('unauthenticated');
  });
  it('submits a legacy password without applying the signup password policy', async () => {
    const sent: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn(async (req: Request) => { sent.push(await req.json()); return Response.json({ success: true, data: { ...session, twoFactorRequired: false } }); }));
    mount(); fillLogin();
    fireEvent.change(screen.getByLabelText(/^Mật khẩu/), { target: { value: 'old' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/workplaces'));
    expect(sent).toEqual([expect.objectContaining({ password: 'old' })]);
  });
});

