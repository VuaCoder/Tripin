import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import {
  AGENCY_VERIFICATION_STATUS,
  PERSISTED_ROLES,
  ROLES,
  USER_STATUS,
} from '@travel-platform/constants';

const agencyProfileSchema = new Schema(
  {
    companyName: { type: String, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 5000 },
    address: { type: String, trim: true, maxlength: 500 },
    website: { type: String, trim: true, maxlength: 300 },
    licenseNumber: { type: String, trim: true, maxlength: 100 },
    verificationStatus: {
      type: String,
      enum: Object.values(AGENCY_VERIFICATION_STATUS),
      default: AGENCY_VERIFICATION_STATUS.UNVERIFIED,
    },
    verifiedAt: { type: Date },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    verificationNote: { type: String, trim: true, maxlength: 1000 },
  },
  { _id: false },
);

const guideProfileSchema = new Schema(
  {
    bio: { type: String, trim: true, maxlength: 5000 },
    languages: { type: [String], default: [] },
    specialties: { type: [String], default: [] },
    experienceYears: { type: Number, min: 0, max: 80 },
    licenseNumber: { type: String, trim: true, maxlength: 100 },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, select: false },
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 30 },
    avatarUrl: { type: String, trim: true, maxlength: 500 },

    role: { type: String, enum: PERSISTED_ROLES, default: ROLES.TRAVELER, required: true },
    /** Extra permissions granted by SUPER_ADMIN on top of the role defaults. */
    extraPermissions: { type: [String], default: [] },
    status: { type: String, enum: Object.values(USER_STATUS), default: USER_STATUS.PENDING_VERIFICATION },

    emailVerifiedAt: { type: Date },
    googleId: { type: String, unique: true, sparse: true },
    twoFactorEnabled: { type: Boolean, default: false },
    lastLoginAt: { type: Date },

    bannedAt: { type: Date },
    bannedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    banReason: { type: String, trim: true, maxlength: 1000 },

    agencyProfile: { type: agencyProfileSchema },
    guideProfile: { type: guideProfileSchema },
  },
  { timestamps: true },
);

// Admin user list: filter by role / status, newest first (also serves "new accounts in the last N days").
userSchema.index({ role: 1, status: 1, createdAt: -1 });
userSchema.index({ createdAt: -1 });
// Moderators list agencies waiting for verification.
userSchema.index({ 'agencyProfile.verificationStatus': 1 }, { sparse: true });

export type UserAttributes = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<UserAttributes>;

export const UserModel = model('User', userSchema);
