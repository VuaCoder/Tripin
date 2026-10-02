import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { OTP_PURPOSE } from '@travel-platform/constants';

const otpSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    purpose: { type: String, enum: Object.values(OTP_PURPOSE), required: true },
    /** HMAC of the code. The plain code only ever exists in the email. */
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    /** Last time a code was issued; drives the resend cooldown. */
    issuedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false },
);

// One live OTP per user+purpose.
otpSchema.index({ userId: 1, purpose: 1 }, { unique: true });
// MongoDB removes expired documents automatically.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type OtpAttributes = InferSchemaType<typeof otpSchema>;
export type OtpDocument = HydratedDocument<OtpAttributes>;
export const OtpModel = model('Otp', otpSchema);
