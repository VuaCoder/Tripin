import { z } from 'zod';
import { OTP_PURPOSE, SELF_REGISTRATION_ROLES } from '@travel-platform/constants';
import { AUTH_POLICY } from './auth.policy';

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const passwordSchema = z
  .string()
  .min(AUTH_POLICY.PASSWORD_MIN_LENGTH, `Password must be at least ${AUTH_POLICY.PASSWORD_MIN_LENGTH} characters`)
  .max(AUTH_POLICY.PASSWORD_MAX_LENGTH)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a digit');

const otpCode = z.string().regex(new RegExp(`^\\d{${AUTH_POLICY.OTP_LENGTH}}$`), 'Invalid code');

export const registerBody = z.object({
  email,
  password: passwordSchema,
  fullName: z.string().trim().min(2).max(120),
  role: z.enum(SELF_REGISTRATION_ROLES).default('TRAVELER'),
});

export const loginBody = z.object({
  email,
  // Do not apply the password policy on login: it must not leak the rules and must accept legacy passwords.
  password: z.string().min(1).max(AUTH_POLICY.PASSWORD_MAX_LENGTH),
});

export const verifyOtpBody = z.object({
  email,
  code: otpCode,
  purpose: z.enum([OTP_PURPOSE.REGISTER, OTP_PURPOSE.LOGIN_2FA]),
});

export const googleLoginBody = z.object({
  idToken: z.string().min(10).max(4096),
  /** Only used when the Google account creates a brand-new Tripri account. */
  role: z.enum(SELF_REGISTRATION_ROLES).optional(),
});

export const forgotPasswordBody = z.object({ email });

export const resetPasswordBody = z.object({
  email,
  code: otpCode,
  newPassword: passwordSchema,
});

export const twoFactorBody = z.object({
  enabled: z.boolean(),
  password: z.string().max(AUTH_POLICY.PASSWORD_MAX_LENGTH).optional(),
});

export type RegisterBody = z.infer<typeof registerBody>;
export type LoginBody = z.infer<typeof loginBody>;
export type VerifyOtpBody = z.infer<typeof verifyOtpBody>;
export type GoogleLoginBody = z.infer<typeof googleLoginBody>;
export type ForgotPasswordBody = z.infer<typeof forgotPasswordBody>;
export type ResetPasswordBody = z.infer<typeof resetPasswordBody>;
export type TwoFactorBody = z.infer<typeof twoFactorBody>;
