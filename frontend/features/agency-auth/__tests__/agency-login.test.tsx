import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  dispatch: vi.fn(),
  login: vi.fn(),
  loginWithGoogle: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/store/hooks', () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock('../AgencyAuthShell', () => ({ AgencyAuthShell: ({ children }: any) => <div>{children}</div> }));
vi.mock('@/features/auth', () => ({
  GoogleLoginButton: ({ authenticate, onSuccess, onError, label }: any) => (
    <button
      type="button"
      onClick={async () => {
        try {
          const session = await authenticate('google-id-token');
          onSuccess?.({ twoFactorRequired: false, ...session });
        } catch (err) {
          onError?.(err instanceof Error ? err.message : 'Google login failed');
        }
      }}
    >
      {label}
    </button>
  ),
}));
vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return {
    ...actual,
    agencyAuthApi: {
      ...actual.agencyAuthApi,
      login: mocks.login,
      loginWithGoogle: mocks.loginWithGoogle,
    },
  };
});

import { AgencyLoginPage } from '../AgencyLoginPage';

beforeEach(() => {
  mocks.push.mockClear();
  mocks.dispatch.mockClear();
  mocks.login.mockReset();
  mocks.loginWithGoogle.mockReset();
});
afterEach(cleanup);

describe('AgencyLoginPage', () => {
  it('toggles password visibility with the eye button', () => {
    render(<AgencyLoginPage />);
    const passwordInput = screen.getByPlaceholderText('Nhập mật khẩu') as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
    expect(passwordInput.type).toBe('text');

    fireEvent.click(screen.getByRole('button', { name: 'Ẩn mật khẩu' }));
    expect(passwordInput.type).toBe('password');
  });

  it('sends rememberMe flag when checked and saves credentials', async () => {
    mocks.login.mockResolvedValue({
      twoFactorRequired: false,
      accessToken: 'agency-long-token',
      user: { id: 'a1', email: 'partner@agency.vn', role: 'AGENCY', agencyProfile: { verificationStatus: 'VERIFIED' } },
    });

    render(<AgencyLoginPage />);
    fireEvent.change(screen.getByPlaceholderText('partner@agency.vn'), { target: { value: 'partner@agency.vn' } });
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'Secret123' } });
    fireEvent.click(screen.getByLabelText('Remember me'));
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập Agency' }));

    await waitFor(() => expect(mocks.login).toHaveBeenCalledWith({
      email: 'partner@agency.vn',
      password: 'Secret123',
      rememberMe: true,
    }));
    expect(mocks.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ accessToken: 'agency-long-token', rememberMe: true }),
    }));
    expect(mocks.push).toHaveBeenCalledWith('/agency');
  });

  it('supports Agency Google login with rememberMe and redirects by verificationStatus', async () => {
    mocks.loginWithGoogle.mockResolvedValue({
      accessToken: 'google-agency-token',
      user: { id: 'a2', email: 'gmail@agency.vn', role: 'AGENCY', agencyProfile: { verificationStatus: 'PENDING' } },
    });

    render(<AgencyLoginPage />);
    fireEvent.click(screen.getByLabelText('Remember me'));
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập bằng Gmail / Google' }));

    await waitFor(() =>
      expect(mocks.loginWithGoogle).toHaveBeenCalledWith({
        idToken: 'google-id-token',
        rememberMe: true,
      }),
    );
    expect(mocks.push).toHaveBeenCalledWith('/application-status?email=gmail%40agency.vn');
  });
});

