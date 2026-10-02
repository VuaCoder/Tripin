import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const refreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    /** sha256 of the raw token; the raw token only lives in the client's HttpOnly cookie. */
    tokenHash: { type: String, required: true, unique: true },
    /** All tokens produced by rotating one login share a family; reuse of a revoked token revokes the family. */
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    ip: { type: String },
    userAgent: { type: String, maxlength: 300 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshTokenAttributes = InferSchemaType<typeof refreshTokenSchema>;
export type RefreshTokenDocument = HydratedDocument<RefreshTokenAttributes>;
export const RefreshTokenModel = model('RefreshToken', refreshTokenSchema);
