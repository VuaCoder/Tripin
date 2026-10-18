import type { UserProfile } from '@/features/auth/types';

export interface UpdateProfileRequest {
  fullName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  /** Accepted by `PATCH /users/me` for `AGENCY`. */
  agencyProfile?: {
    companyName?: string;
    description?: string;
    address?: string;
    website?: string;
    licenseNumber?: string;
  };
  /** Accepted by `PATCH /users/me` for `TOUR_GUIDE` only. */
  guideProfile?: {
    bio?: string;
    languages?: string[];
    specialties?: string[];
    experienceYears?: number;
    licenseNumber?: string;
    licenseImageUrl?: string | null;
  };
}

/** Cloudinary direct-upload contract shared by the avatar and the guide license image. */
export interface ImageUploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  publicId: string;
  uploadUrl: string;
  params: {
    public_id: string;
    overwrite: 'true' | 'false';
    tags: string;
  };
}

export type AvatarChange =
  | { kind: 'unchanged' }
  | { kind: 'upload'; file: File }
  | { kind: 'remove' };

export interface SecuritySettings {
  passwordConfigured: boolean;
  googleLinked: boolean;
  twoFactorEnabled: boolean;
  twoFactorMethod: string;
}

export interface SetTwoFactorRequest {
  enabled: boolean;
  password?: string;
}
