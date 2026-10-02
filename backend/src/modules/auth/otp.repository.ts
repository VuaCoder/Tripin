import type { OtpPurpose } from '@travel-platform/constants';
import { OtpModel, type OtpDocument } from './otp.model';

export class OtpRepository {
  findLive(userId: string, purpose: OtpPurpose): Promise<OtpDocument | null> {
    return OtpModel.findOne({ userId, purpose }).exec();
  }

  /** Replaces any existing OTP of the same user+purpose with a fresh one. */
  upsert(userId: string, purpose: OtpPurpose, codeHash: string, expiresAt: Date): Promise<OtpDocument | null> {
    return OtpModel.findOneAndUpdate(
      { userId, purpose },
      { $set: { codeHash, expiresAt, attempts: 0, issuedAt: new Date() } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).exec();
  }

  /** Atomically counts an attempt and returns the document AFTER the increment. */
  registerAttempt(id: string): Promise<OtpDocument | null> {
    return OtpModel.findByIdAndUpdate(id, { $inc: { attempts: 1 } }, { returnDocument: 'after' }).exec();
  }

  /** Atomic delete: returns null when someone else already consumed it (prevents double use). */
  consume(id: string): Promise<OtpDocument | null> {
    return OtpModel.findByIdAndDelete(id).exec();
  }

  deleteFor(userId: string, purpose: OtpPurpose): Promise<unknown> {
    return OtpModel.deleteMany({ userId, purpose }).exec();
  }
}

export const otpRepository = new OtpRepository();
