import type { UserProfile } from '@/features/auth/types';

export interface UpdateProfileRequest {
  fullName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
}

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
