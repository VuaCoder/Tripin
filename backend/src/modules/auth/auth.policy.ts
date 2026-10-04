/** Tunable authentication rules in one place (no magic numbers scattered in services). */
export const AUTH_POLICY = {
  BCRYPT_ROUNDS: 12,
  PASSWORD_MIN_LENGTH: 8,
  /** bcrypt only hashes the first 72 bytes. */
  PASSWORD_MAX_LENGTH: 72,
  OTP_LENGTH: 6,
  OTP_TTL_MINUTES: 10,
  OTP_MAX_ATTEMPTS: 5,
  OTP_RESEND_COOLDOWN_SECONDS: 60,
  REFRESH_COOKIE_NAME: 'refresh_token',
  REFRESH_COOKIE_PATH: '/api/v1/auth',
  ACCESS_TOKEN_ISSUER: 'tripri-api',
} as const;
