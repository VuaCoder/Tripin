import {
  AGENCY_VERIFICATION_STATUS,
  USER_STATUS,
  type AgencyVerificationStatus,
  type Permission,
  type PersistedRole,
  type Role,
  type UserStatus,
} from '@travel-platform/constants';
import type { TransitionMap } from '../../utils/state-machine';

/** Private representation: returned only to the account owner (and staff where documented). */
export interface PrivateUserDto {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  role: Role;
  status: UserStatus;
  permissions: Permission[];
  /** Only the extra grants (role defaults excluded). Useful for the admin screen. */
  extraPermissions: Permission[];
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

/** "View public tour guide profile" — no email/phone/status. */
export interface PublicGuideDto {
  id: string;
  fullName: string;
  avatarUrl?: string;
  bio?: string;
  languages: string[];
  specialties: string[];
  experienceYears?: number;
}

/** "View public agency profile" — no email/phone/license number. */
export interface PublicAgencyDto {
  id: string;
  fullName: string;
  avatarUrl?: string;
  companyName?: string;
  description?: string;
  address?: string;
  website?: string;
  verified: boolean;
}

export interface UpdateProfileInput {
  fullName?: string;
  phone?: string;
  avatarUrl?: string;
  agencyProfile?: {
    companyName?: string;
    description?: string;
    address?: string;
    website?: string;
    licenseNumber?: string;
  };
  guideProfile?: {
    bio?: string;
    languages?: string[];
    specialties?: string[];
    experienceYears?: number;
    licenseNumber?: string;
  };
}

export interface ListUsersQuery {
  page: number;
  limit: number;
  role?: PersistedRole;
  status?: UserStatus;
  q?: string;
}

export interface AssignAccessInput {
  role?: PersistedRole;
  extraPermissions?: Permission[];
}

const A = AGENCY_VERIFICATION_STATUS;
/** Agency verification workflow (owned here, driven by the moderation module). */
export const AGENCY_VERIFICATION_TRANSITIONS: TransitionMap<AgencyVerificationStatus> = {
  [A.UNVERIFIED]: [A.PENDING],
  [A.PENDING]: [A.VERIFIED, A.REJECTED],
  [A.REJECTED]: [A.PENDING],
};

const U = USER_STATUS;
/** Account status changes allowed after activation (PENDING -> ACTIVE belongs to auth). */
export const USER_STATUS_TRANSITIONS: TransitionMap<UserStatus> = {
  [U.PENDING_VERIFICATION]: [U.ACTIVE],
  [U.ACTIVE]: [U.BANNED],
  [U.BANNED]: [U.ACTIVE],
};
