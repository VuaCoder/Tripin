import {
  LoginFormValues,
  LoginResultData,
  AuthApiResponse,
  GoogleAuthPayload,
} from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export const authApi = {
  /**
   * Đăng nhập với Email / Số điện thoại và Mật khẩu
   */
  async login(values: LoginFormValues): Promise<AuthApiResponse<LoginResultData>> {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Cho phép nhận HttpOnly refresh token cookie
      body: JSON.stringify({
        email: values.credential,
        password: values.password,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || 'Đăng nhập không thành công');
    }
    return data;
  },

  /**
   * Đăng nhập nhanh qua Google OAuth IdToken
   */
  async loginWithGoogle(payload: GoogleAuthPayload): Promise<AuthApiResponse<LoginResultData>> {
    const res = await fetch(`${API_BASE_URL}/auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || 'Đăng nhập Google thất bại');
    }
    return data;
  },

  /**
   * Đăng xuất hệ thống và xóa refresh cookie
   */
  async logout(): Promise<void> {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  },

  /**
   * Làm mới access token thông qua refresh cookie
   */
  async refreshToken(): Promise<AuthApiResponse<LoginResultData>> {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    return res.json();
  },
};
