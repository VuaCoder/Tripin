import type { PersistedRole, SelfRegistrationRole } from '@travel-platform/constants';
import type { PrivateUserDto } from '../users/users.types';

export interface AccessTokenPayload {
  sub: string;
  tokenVersion: number;
  role: PersistedRole;
}

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role: SelfRegistrationRole;
}

export interface AgencyRegisterInput {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  companyName: string;
  licenseNumber: string;
  taxId?: string;
  businessLicenseUrl?: string;
  address: string;
  description?: string;
  website?: string;
}

export interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface Session {
  agencies?: import('../agencies/agency.service').AgencyMembershipDto[];
  accessToken: string;
  /** Raw refresh token. The controller moves it into an HttpOnly cookie and NEVER returns it in the body. */
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  user: PrivateUserDto;
}

export type LoginResult =
  | { twoFactorRequired: true; email: string }
  | { twoFactorRequired: false; session: Session };

export type AgencyOtpResult =
  | { registrationComplete: true; email: string; agencyVerificationStatus: 'PENDING'; statusToken: string }
  | { registrationComplete: false; session: Session };

export interface RequestContext {
  ip?: string;
  userAgent?: string;
}
