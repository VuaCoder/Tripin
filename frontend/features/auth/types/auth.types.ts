export type UserRole = 'TRAVELER' | 'AGENCY' | 'TOUR_GUIDE' | 'MODERATOR' | 'SUPER_ADMIN';

export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'BANNED';

export type AgencyVerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

/** Roles a guest can self-register with from the public auth pages. */
export type RegisterableRole = 'TRAVELER' | 'TOUR_GUIDE';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  role: UserRole;
  status: UserStatus;
  permissions: string[];
  extraPermissions: string[];
  twoFactorEnabled: boolean;
  emailVerifiedAt?: string;
  createdAt: string;
  bannedAt?: string;
  banReason?: string;
  agencyProfile?: {
    companyName?: string;
    description?: string;
    address?: string;
    website?: string;
    licenseNumber?: string;
    verificationStatus: AgencyVerificationStatus;
    verificationNote?: string;
  };
  guideProfile?: {
    bio?: string;
    languages: string[];
    specialties: string[];
    experienceYears?: number;
    licenseNumber?: string;
  };
}

export interface LoginFormValues {
  credential: string; // Email hoặc số điện thoại
  password: string;
  rememberMe?: boolean;
}

export interface RegisterFormValues {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  role?: 'TRAVELER' | 'TOUR_GUIDE';
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role?: RegisterableRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterResultData {
  email: string;
  otpExpiresInSeconds: number;
  message?: string;
}

export interface SessionData {
  accessToken: string;
  user: UserProfile;
}

export interface LoginSuccessData {
  twoFactorRequired: false;
  accessToken: string;
  user: UserProfile;
}

export interface Login2FARequiredData {
  twoFactorRequired: true;
  email: string;
}

export type LoginResultData = LoginSuccessData | Login2FARequiredData;

export type VerifyOtpPurpose = 'REGISTER' | 'LOGIN_2FA' | 'FORGOT_PASSWORD';

export interface VerifyOtpRequest {
  email: string;
  code: string;
  purpose: VerifyOtpPurpose;
}

export type ResendOtpPurpose = 'REGISTER' | 'LOGIN_2FA' | 'FORGOT_PASSWORD';

export interface ResendOtpRequest {
  email: string;
  purpose: ResendOtpPurpose;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
}

export interface AuthApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface GoogleAuthPayload {
  idToken: string;
  role?: 'TRAVELER' | 'TOUR_GUIDE';
}

export type AuthStatus = 'idle' | 'authenticated' | 'unauthenticated';

export interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  status: AuthStatus;
}
