export type AgencyOtpPurpose = 'REGISTER' | 'LOGIN_2FA';

export interface AgencyRegisterPayload {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  companyName: string;
  licenseNumber: string;
  address: string;
  description?: string;
  website?: string;
}

export interface AgencyUser {
  id: string;
  email: string;
  fullName: string;
  role: 'AGENCY';
  status: 'ACTIVE';
  phone?: string | null;
}

export type AgencyLoginResult =
  | { twoFactorRequired: true; email: string }
  | { twoFactorRequired: false; accessToken: string; user: AgencyUser };

export type AgencyVerifyResult =
  | { registrationComplete: true; email: string; agencyVerificationStatus: 'PENDING' }
  | { registrationComplete: false; accessToken: string; user: AgencyUser };

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string; details?: unknown };
}
