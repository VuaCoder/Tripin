import type {
  AgencyLoginResult,
  AgencyOtpPurpose,
  AgencyRegisterPayload,
  AgencyUser,
  AgencyVerifyResult,
  ApiEnvelope,
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export class AgencyApiError extends Error {
  constructor(
    message: string,
    public readonly code = 'REQUEST_FAILED',
    public readonly status = 0,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AgencyApiError';
  }
}

async function request<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
  } catch {
    throw new AgencyApiError('Không thể kết nối máy chủ. Vui lòng thử lại.', 'NETWORK_ERROR');
  }

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !payload?.success) {
    throw new AgencyApiError(
      payload?.error?.message || 'Yêu cầu chưa thể xử lý. Vui lòng thử lại.',
      payload?.error?.code,
      response.status,
      payload?.error?.details,
    );
  }
  return payload.data;
}

export const agencyAuthApi = {
  register(payload: AgencyRegisterPayload) {
    return request<{ email: string; otpExpiresInSeconds: number; message: string }>('/auth/agency/register', payload);
  },

  login(payload: { email: string; password: string }) {
    return request<AgencyLoginResult>('/auth/agency/login', payload);
  },

  verifyOtp(payload: { email: string; code: string; purpose: AgencyOtpPurpose }) {
    return request<AgencyVerifyResult>('/auth/agency/verify-otp', payload);
  },

  resendOtp(payload: { email: string; purpose: AgencyOtpPurpose }) {
    return request<{ expiresInSeconds: number; message: string }>('/auth/agency/resend-otp', payload);
  },

  refreshSession() {
    return request<{ accessToken: string; user: AgencyUser }>('/auth/refresh', undefined);
  },

  async logout(): Promise<void> {
    await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
  },
};
