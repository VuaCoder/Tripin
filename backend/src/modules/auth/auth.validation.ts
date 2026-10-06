import { z } from 'zod';
import { OTP_PURPOSE, ROLES } from '@travel-platform/constants';
import { AUTH_POLICY } from './auth.policy';

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const passwordSchema = z
  .string()
  .min(AUTH_POLICY.PASSWORD_MIN_LENGTH, `Password must be at least ${AUTH_POLICY.PASSWORD_MIN_LENGTH} characters`)
  .max(AUTH_POLICY.PASSWORD_MAX_LENGTH)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a digit');

const otpCode = z.string().regex(new RegExp(`^\\d{${AUTH_POLICY.OTP_LENGTH}}$`), 'Invalid code');
const phone = z.string().trim().regex(/^\+?[0-9 ().-]{6,20}$/, 'Invalid phone number');
const customerRegistrationRoles = [ROLES.TRAVELER, ROLES.TOUR_GUIDE] as const;

export const registerBody = z.object({
  email,
  password: passwordSchema,
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).optional(),
  role: z.enum(customerRegistrationRoles).default(ROLES.TRAVELER),
});

export const agencyRegisterBody = z
  .object({
    email,
    password: passwordSchema,
    fullName: z.string().trim().min(2).max(120),
    phone,
    companyName: z.string().trim().min(2).max(200),
    licenseNumber: z.string().trim().min(3).max(100),
    address: z.string().trim().min(5).max(500),
    description: z.string().trim().max(5000).optional(),
    website: z.url().max(300).optional(),
  })
  .strict();

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

export const agencyVerifyOtpBody = z.object({
  email,
  code: otpCode,
  purpose: z.enum([OTP_PURPOSE.REGISTER, OTP_PURPOSE.LOGIN_2FA]),
});

export const agencyResendOtpBody = z.object({
  email,
  purpose: z.enum([OTP_PURPOSE.REGISTER, OTP_PURPOSE.LOGIN_2FA]),
});

export const googleLoginBody = z.object({
  idToken: z.string().min(10).max(4096),
  /** Only used when the Google account creates a brand-new Tripri account. */
  role: z.enum([ROLES.TRAVELER, ROLES.TOUR_GUIDE] as const).optional(),
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

export const resendOtpBody = z.object({
  email,
  purpose: z.enum([OTP_PURPOSE.REGISTER, OTP_PURPOSE.LOGIN_2FA, OTP_PURPOSE.FORGOT_PASSWORD]),
});

export type RegisterBody = z.infer<typeof registerBody>;
export type AgencyRegisterBody = z.infer<typeof agencyRegisterBody>;
export type LoginBody = z.infer<typeof loginBody>;
export type VerifyOtpBody = z.infer<typeof verifyOtpBody>;
export type AgencyVerifyOtpBody = z.infer<typeof agencyVerifyOtpBody>;
export type AgencyResendOtpBody = z.infer<typeof agencyResendOtpBody>;
export type GoogleLoginBody = z.infer<typeof googleLoginBody>;
export type ForgotPasswordBody = z.infer<typeof forgotPasswordBody>;
export type ResetPasswordBody = z.infer<typeof resetPasswordBody>;
export type TwoFactorBody = z.infer<typeof twoFactorBody>;
export type ResendOtpBody = z.infer<typeof resendOtpBody>;
