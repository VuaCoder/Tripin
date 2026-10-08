import type { UserProfile } from '@/features/auth/types';

export interface UpdateProfileRequest {
  fullName?: string;
  phone?: string | null;
}

export interface AvatarUploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  publicId: string;
  uploadUrl: string;
  params: {
    public_id: string;
    overwrite: 'true';
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
