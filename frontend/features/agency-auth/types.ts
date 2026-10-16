export type AgencyOtpPurpose = 'REGISTER' | 'LOGIN_2FA';

export interface AgencyRegisterPayload {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  companyName: string;
  licenseNumber: string;
  taxId?: string;
  businessLicenseUrl?: string;
  address: string;
  description?: string;
  website?: string;
}

export interface AgencyUser {
  id: string;
  email: string;
  fullName: string;
  role: 'AGENCY';
  status: 'ACTIVE' | 'PENDING_VERIFICATION' | 'BANNED';
  phone?: string | null;
  agencyProfile?: {
    companyName?: string;
    description?: string;
    address?: string;
    website?: string;
    licenseNumber?: string;
    taxId?: string;
    businessLicenseUrl?: string;
    verificationStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
    verificationNote?: string;
  };
}

export type AgencyLoginResult =
  | { twoFactorRequired: true; email: string }
  | { twoFactorRequired: false; accessToken: string; user: AgencyUser };

export type AgencyVerifyResult =
  | { registrationComplete: true; email: string; agencyVerificationStatus: 'PENDING'; statusToken?: string }
  | { registrationComplete: false; accessToken: string; user: AgencyUser };

export interface AgencyApplicationStatusDto {
  email: string;
  fullName: string;
  companyName: string;
  verificationStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  verificationNote?: string | null;
  submittedAt: string;
  token: string;
}

export interface AgencyApplicationDetailsDto {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  licenseNumber: string;
  taxId?: string | null;
  businessLicenseUrl?: string | null;
  address: string;
  description?: string | null;
  website?: string | null;
  verificationStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  verificationNote?: string | null;
}

export interface UpdateAgencyApplicationPayload {
  fullName: string;
  phone: string;
  companyName: string;
  licenseNumber: string;
  taxId?: string;
  businessLicenseUrl?: string;
  address: string;
  description?: string;
  website?: string;
  email?: string;
  token?: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string; details?: unknown };
}
