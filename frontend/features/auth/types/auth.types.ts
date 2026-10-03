export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: 'TRAVELER' | 'AGENCY' | 'TOUR_GUIDE' | 'MODERATOR' | 'SUPER_ADMIN';
  status: 'PENDING_VERIFICATION' | 'ACTIVE' | 'BANNED';
  avatarUrl?: string;
  phoneNumber?: string;
  createdAt: string;
}

export interface LoginFormValues {
  credential: string; // Email hoặc số điện thoại
  password: string;
  rememberMe?: boolean;
}

export interface LoginSuccessData {
  twoFactorRequired: false;
  accessToken: string;
  user: UserProfile;
}

export interface Login2FARequiredData {
  twoFactorRequired: true;
  email: string;
}

export type LoginResultData = LoginSuccessData | Login2FARequiredData;

export interface AuthApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface GoogleAuthPayload {
  idToken: string;
  role?: 'TRAVELER' | 'AGENCY' | 'TOUR_GUIDE';
}

export interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
