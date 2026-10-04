import type { PersistedRole, SelfRegistrationRole } from '@travel-platform/constants';
import type { PrivateUserDto } from '../users/users.types';

export interface AccessTokenPayload {
  sub: string;
  role: PersistedRole;
}

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role: SelfRegistrationRole;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface Session {
  accessToken: string;
  /** Raw refresh token. The controller moves it into an HttpOnly cookie and NEVER returns it in the body. */
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  user: PrivateUserDto;
}

export type LoginResult =
  | { twoFactorRequired: true; email: string }
  | { twoFactorRequired: false; session: Session };

export interface RequestContext {
  ip?: string;
  userAgent?: string;
}
