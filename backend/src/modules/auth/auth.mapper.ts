import type { Response } from 'express';
import { env, isProduction } from '../../config/env';
import { AUTH_POLICY } from './auth.policy';
import type { Session } from './auth.types';

/** What the client receives after authenticating. The refresh token is deliberately absent (cookie only). */
export function toSessionResponse(session: Session) {
  return { accessToken: session.accessToken, user: session.user };
}

export function setRefreshCookie(res: Response, session: Pick<Session, 'refreshToken' | 'refreshTokenExpiresAt'>): void {
  res.cookie(AUTH_POLICY.REFRESH_COOKIE_NAME, session.refreshToken, {
    httpOnly: true,
    secure: isProduction || env.COOKIE_SAME_SITE === 'none',
    sameSite: env.COOKIE_SAME_SITE,
    path: AUTH_POLICY.REFRESH_COOKIE_PATH,
    expires: session.refreshTokenExpiresAt,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(AUTH_POLICY.REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction || env.COOKIE_SAME_SITE === 'none',
    sameSite: env.COOKIE_SAME_SITE,
    path: AUTH_POLICY.REFRESH_COOKIE_PATH,
  });
}
