import {
  LoginFormValues,
  LoginResultData,
  AuthApiResponse,
  GoogleAuthPayload,
} from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

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
   * Đăng ký tài khoản (Traveler / Agency / Tour guide)
   */
  async register(values: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    role?: 'TRAVELER' | 'AGENCY' | 'TOUR_GUIDE';
  }): Promise<AuthApiResponse<{ email: string; otpExpiresInSeconds: number }>> {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        password: values.password,
        role: values.role || 'TRAVELER',
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || 'Đăng ký tài khoản thất bại');
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

  /**
   * Xác thực mã OTP
   */
  async verifyOtp(payload: { email: string; code: string; purpose: string }): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || 'Xác thực OTP thất bại');
    }
    return data;
  },

  /**
   * Gửi lại mã OTP
   */
  async resendOtp(payload: { email: string; purpose: string }): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/auth/resend-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || 'Gửi lại OTP thất bại');
    }
    return data;
  },

  /**
   * Quên mật khẩu - Gửi mã OTP khôi phục về Email
   */
  async forgotPassword(payload: { email: string }): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || 'Gửi yêu cầu đặt lại mật khẩu thất bại');
    }
    return data;
  },

  /**
   * Đặt lại mật khẩu mới bằng mã OTP
   */
  async resetPassword(payload: { email: string; code: string; newPassword: string }): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || 'Đặt lại mật khẩu thất bại');
    }
    return data;
  },
};
