import type {
  AgencyApplicationDetailsDto,
  AgencyApplicationStatusDto,
  AgencyLoginResult,
  AgencyOtpPurpose,
  AgencyRegisterPayload,
  AgencyUser,
  AgencyVerifyResult,
  ApiEnvelope,
  UpdateAgencyApplicationPayload,
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

async function handleResponse<T>(response: Response): Promise<T> {
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

async function request<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new AgencyApiError('Không thể kết nối máy chủ. Vui lòng thử lại.', 'NETWORK_ERROR');
  }

  return handleResponse<T>(response);
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

  async uploadLicenseImage(file: File): Promise<{ url: string; publicId: string }> {
    const formData = new FormData();
    formData.append('file', file);

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/auth/agency/upload-license`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
    } catch {
      throw new AgencyApiError('Không thể tải file lên máy chủ. Vui lòng thử lại.', 'NETWORK_ERROR');
    }

    return handleResponse<{ url: string; publicId: string }>(response);
  },

  async getApplicationStatus(params: { token?: string; email?: string }): Promise<AgencyApplicationStatusDto> {
    const url = new URL(`${API_BASE_URL}/auth/agency/application-status`);
    if (params.token) url.searchParams.set('token', params.token);
    if (params.email) url.searchParams.set('email', params.email);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'include',
      });
    } catch {
      throw new AgencyApiError('Không thể lấy trạng thái hồ sơ. Vui lòng kiểm tra kết nối mạng.', 'NETWORK_ERROR');
    }

    return handleResponse<AgencyApplicationStatusDto>(response);
  },

  async getApplicationDetails(params: { token?: string; email?: string }): Promise<AgencyApplicationDetailsDto> {
    const url = new URL(`${API_BASE_URL}/auth/agency/application`);
    if (params.token) url.searchParams.set('token', params.token);
    if (params.email) url.searchParams.set('email', params.email);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'include',
      });
    } catch {
      throw new AgencyApiError('Không thể tải chi tiết hồ sơ. Vui lòng thử lại.', 'NETWORK_ERROR');
    }

    return handleResponse<AgencyApplicationDetailsDto>(response);
  },

  updateApplication(payload: UpdateAgencyApplicationPayload) {
    return request<{ success: true; message: string; status: AgencyApplicationStatusDto }>('/auth/agency/application', payload, 'PUT');
  },

  devAccept(params: { token?: string; email?: string }) {
    return request<{ success: true; message: string; status: AgencyApplicationStatusDto }>('/auth/agency/dev-accept', params);
  },

  devReject(params: { token?: string; email?: string; reason: string }) {
    return request<{ success: true; message: string; status: AgencyApplicationStatusDto }>('/auth/agency/dev-reject', params);
  },

  refreshSession() {
    return request<{ accessToken: string; user: AgencyUser }>('/auth/refresh', undefined);
  },

  async logout(): Promise<void> {
    await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
  },
};
