import type { OtpPurpose } from '@travel-platform/constants';
import { nullIfNotFound, prisma } from '../../config/database';
import type { Otp } from '../../generated/prisma/client';

export type OtpRecord = Otp;

export class OtpRepository {
  findLive(userId: string, purpose: OtpPurpose): Promise<OtpRecord | null> {
    return prisma.otp.findUnique({ where: { userId_purpose: { userId, purpose } } });
  }

  /** Replaces any existing OTP of the same user+purpose with a fresh one. */
  upsert(userId: string, purpose: OtpPurpose, codeHash: string, expiresAt: Date): Promise<OtpRecord | null> {
    const fresh = { codeHash, expiresAt, attempts: 0, issuedAt: new Date() };
    return prisma.otp.upsert({
      where: { userId_purpose: { userId, purpose } },
      create: { userId, purpose, ...fresh },
      update: fresh,
    });
  }

  /** Atomically counts an attempt and returns the record AFTER the increment. */
  registerAttempt(id: string): Promise<OtpRecord | null> {
    return prisma.otp.update({ where: { id }, data: { attempts: { increment: 1 } } }).catch(nullIfNotFound);
  }

  /** Atomic delete: returns null when someone else already consumed it (prevents double use). */
  consume(id: string): Promise<OtpRecord | null> {
    return prisma.otp.delete({ where: { id } }).catch(nullIfNotFound);
  }

  /** Codes past their expiry (PostgreSQL has no TTL index, a periodic job removes them). */
  async deleteExpired(now: Date): Promise<number> {
    return (await prisma.otp.deleteMany({ where: { expiresAt: { lt: now } } })).count;
  }

  deleteFor(userId: string, purpose: OtpPurpose): Promise<unknown> {
    return prisma.otp.deleteMany({ where: { userId, purpose } });
  }
}

export const otpRepository = new OtpRepository();
