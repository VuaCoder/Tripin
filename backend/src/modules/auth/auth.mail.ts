import type { OtpPurpose } from '@travel-platform/constants';
import type { MailMessage } from '../../integrations/mail';
import { AUTH_POLICY } from './auth.policy';

const SUBJECT: Record<OtpPurpose, string> = {
  REGISTER: 'Verify your Tripri account',
  LOGIN_2FA: 'Your Tripri login code',
  FORGOT_PASSWORD: 'Reset your Tripri password',
};

const INTRO: Record<OtpPurpose, string> = {
  REGISTER: 'Use this code to verify your email address',
  LOGIN_2FA: 'Use this code to finish signing in',
  FORGOT_PASSWORD: 'Use this code to reset your password',
};

/** Builds the OTP email. Kept separate from the service so wording can change without touching business logic. */
export function buildOtpMail(to: string, purpose: OtpPurpose, code: string): MailMessage {
  const text =
    `${INTRO[purpose]}: ${code}\n\n` +
    `The code expires in ${AUTH_POLICY.OTP_TTL_MINUTES} minutes. If you did not request it, ignore this email.`;
  return { to, subject: SUBJECT[purpose], text };
}
