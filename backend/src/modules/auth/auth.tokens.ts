import jwt, { type SignOptions } from 'jsonwebtoken';
import type { PersistedRole } from '@travel-platform/constants';
import { env } from '../../config/env';
import { AppError, ERROR_CODES } from '../../utils/app-error';
import { randomToken, sha256 } from '../../utils/crypto';
import { AUTH_POLICY } from './auth.policy';
import type { AccessTokenPayload } from './auth.types';

/** JWT access token helpers. Roles inside the token are server-signed; they are re-checked against the DB on each request. */
export function signAccessToken(userId: string, role: PersistedRole): string {
  const payload: AccessTokenPayload = { sub: userId, role };
  const options: SignOptions = {
    algorithm: 'HS256',
    issuer: AUTH_POLICY.ACCESS_TOKEN_ISSUER,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: AUTH_POLICY.ACCESS_TOKEN_ISSUER,
    });
    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') throw new Error('bad payload');
    return decoded as unknown as AccessTokenPayload;
  } catch {
    throw AppError.unauthenticated('Invalid or expired access token', ERROR_CODES.TOKEN_INVALID);
  }
}

/** Opaque refresh token: random value, only its hash is stored. */
export function generateRefreshToken(): { raw: string; hash: string; expiresAt: Date } {
  const raw = randomToken(48);
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);
  return { raw, hash: sha256(raw), expiresAt };
}

export function hashRefreshToken(raw: string): string {
  return sha256(raw);
}
