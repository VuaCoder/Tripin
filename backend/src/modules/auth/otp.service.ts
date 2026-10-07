import type { OtpPurpose } from '@travel-platform/constants';
import { env } from '../../config/env';
import { AppError, ERROR_CODES } from '../../utils/app-error';
import { hmacSha256, randomNumericCode, safeEqual } from '../../utils/crypto';
import { AUTH_POLICY } from './auth.policy';
import { otpRepository, type OtpRepository } from './otp.repository';

/**
 * Issues and verifies one-time codes ("Verify OTP" use case, shared by register, login 2FA and forgot password).
 * The plain code is returned to the caller only so it can be emailed; it is never stored or logged.
 */
export class OtpService {
  constructor(private readonly otps: Pick<OtpRepository, 'findLive' | 'upsert' | 'registerAttempt' | 'consume' | 'deleteExpired'> = otpRepository) {}

  private hash(userId: string, purpose: OtpPurpose, code: string): string {
    return hmacSha256(env.JWT_ACCESS_SECRET, `${userId}:${purpose}:${code}`);
  }

  async issue(userId: string, purpose: OtpPurpose): Promise<{ code: string; expiresInSeconds: number }> {
    const existing = await this.otps.findLive(userId, purpose);
    if (existing) {
      const elapsedSeconds = (Date.now() - existing.issuedAt.getTime()) / 1000;
      if (elapsedSeconds < AUTH_POLICY.OTP_RESEND_COOLDOWN_SECONDS) {
        throw AppError.tooManyRequests('Please wait before requesting another code', ERROR_CODES.OTP_RESEND_TOO_SOON);
      }
    }
    const code = randomNumericCode(AUTH_POLICY.OTP_LENGTH);
    const expiresInSeconds = AUTH_POLICY.OTP_TTL_MINUTES * 60;
    await this.otps.upsert(userId, purpose, this.hash(userId, purpose, code), new Date(Date.now() + expiresInSeconds * 1000));
    return { code, expiresInSeconds };
  }

  /** Throws unless `code` is the live OTP. A successful verification consumes the OTP (single use). */
  async verify(userId: string, purpose: OtpPurpose, code: string): Promise<void> {
    const live = await this.otps.findLive(userId, purpose);
    if (!live) throw AppError.badRequest('Mã xác thực không tồn tại hoặc đã hết hạn', undefined, ERROR_CODES.OTP_EXPIRED);
    if (live.expiresAt.getTime() <= Date.now()) {
      throw AppError.badRequest('Mã xác thực đã hết hạn', undefined, ERROR_CODES.OTP_EXPIRED);
    }

    // Count the attempt first (atomic) so parallel guesses cannot exceed the limit.
    const counted = await this.otps.registerAttempt(live.id);
    if (!counted) throw AppError.badRequest('Mã xác thực đã hết hạn', undefined, ERROR_CODES.OTP_EXPIRED);
    if (counted.attempts > AUTH_POLICY.OTP_MAX_ATTEMPTS) {
      throw AppError.tooManyRequests('Đã nhập sai quá số lần quy định. Vui lòng lấy mã mới.', ERROR_CODES.OTP_TOO_MANY_ATTEMPTS);
    }
    if (!safeEqual(counted.codeHash, this.hash(userId, purpose, code))) {
      throw AppError.badRequest(AUTH_POLICY.OTP_INVALID_MESSAGE, undefined, ERROR_CODES.OTP_INVALID);
    }
    const consumed = await this.otps.consume(live.id);
    if (!consumed) throw AppError.badRequest(AUTH_POLICY.OTP_INVALID_MESSAGE, undefined, ERROR_CODES.OTP_INVALID);
  }

  /** Removes expired codes; returns how many were deleted. */
  purgeExpired(now = new Date()): Promise<number> {
    return this.otps.deleteExpired(now);
  }
}

export const otpService = new OtpService();
