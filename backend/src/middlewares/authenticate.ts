import type { NextFunction, Request, Response } from 'express';
import { USER_STATUS } from '@travel-platform/constants';
import { verifyAccessToken } from '../modules/auth/auth.tokens';
import { permissionsOf } from '../modules/users/users.mapper';
import { usersRepository } from '../modules/users/users.repository';
import { AppError, ERROR_CODES } from '../utils/app-error';
import { GUEST_ACTOR, type UserActor } from '../types/actor';

/**
 * Turns a bearer access token into the acting user. The role and status are re-read from the database on every call
 * (never trusted from the token), so bans and permission changes apply immediately. Shared by the HTTP middleware and
 * the Socket.IO handshake.
 */
export async function resolveUserActor(token: string): Promise<UserActor> {
  const payload = verifyAccessToken(token);
  const user = await usersRepository.findById(payload.sub);
  if (!user) throw AppError.unauthenticated('Account no longer exists', ERROR_CODES.TOKEN_INVALID);
  if (user.status === USER_STATUS.BANNED) throw AppError.forbidden('This account has been banned', ERROR_CODES.ACCOUNT_BANNED);
  if (user.status !== USER_STATUS.ACTIVE) throw AppError.forbidden('Account is not active', ERROR_CODES.ACCOUNT_NOT_VERIFIED);
  return {
    kind: 'user',
    userId: user.id,
    email: user.email,
    role: user.role as UserActor['role'],
    permissions: permissionsOf(user),
  };
}

/**
 * Resolves `req.actor` for EVERY request:
 *  - no Authorization header      -> GUEST
 *  - valid Bearer access token    -> the user
 *  - malformed / expired token    -> 401 (so clients know to refresh instead of silently becoming GUEST)
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header) {
    req.actor = GUEST_ACTOR;
    return next();
  }

  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return next(AppError.unauthenticated('Malformed Authorization header', ERROR_CODES.TOKEN_INVALID));
  }

  try {
    req.actor = await resolveUserActor(token);
    next();
  } catch (error) {
    next(error);
  }
}
