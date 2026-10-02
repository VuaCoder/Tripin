export const USER_STATUS = {
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  ACTIVE: 'ACTIVE',
  BANNED: 'BANNED',
} as const;
export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

export const OTP_PURPOSE = {
  REGISTER: 'REGISTER',
  LOGIN_2FA: 'LOGIN_2FA',
  FORGOT_PASSWORD: 'FORGOT_PASSWORD',
} as const;
export type OtpPurpose = (typeof OTP_PURPOSE)[keyof typeof OTP_PURPOSE];

export const AGENCY_VERIFICATION_STATUS = {
  UNVERIFIED: 'UNVERIFIED',
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
} as const;
export type AgencyVerificationStatus =
  (typeof AGENCY_VERIFICATION_STATUS)[keyof typeof AGENCY_VERIFICATION_STATUS];
