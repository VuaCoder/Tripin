import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Permission } from '@travel-platform/constants';
import { AppError } from '../utils/app-error';
import type { UserActor } from '../types/actor';

/** Metadata attached to guard middlewares so the route table (docs + audit tests) can tell who may call what. */
export const GUARD_META = Symbol.for('travel.guard');
export type GuardMeta = { kind: 'auth' } | { kind: 'permission'; permissions: Permission[] };

function tag<T extends RequestHandler>(handler: T, meta: GuardMeta): T {
  (handler as unknown as Record<symbol, GuardMeta>)[GUARD_META] = meta;
  return handler;
}

/** 401 unless a real user is logged in. */
export const requireAuth: RequestHandler = tag((req: Request, _res: Response, next: NextFunction) => {
  if (req.actor.kind !== 'user') return next(AppError.unauthenticated());
  next();
}, { kind: 'auth' });

/**
 * Requires ALL listed permissions (centralised RBAC, see packages/constants/src/permissions.ts).
 * Prefer this over checking roles in controllers/services (AI rules section 28).
 */
export function requirePermission(...permissions: Permission[]): RequestHandler {
  return tag((req, _res, next) => {
    if (req.actor.kind !== 'user') return next(AppError.unauthenticated());
    const granted = req.actor.permissions;
    if (!permissions.every((permission) => granted.includes(permission))) return next(AppError.forbidden());
    next();
  }, { kind: 'permission', permissions });
}

/** Typed access to the logged-in actor inside controllers behind `requireAuth` / `requirePermission`. */
export function userActor(req: Request): UserActor {
  if (req.actor.kind !== 'user') throw AppError.unauthenticated();
  return req.actor;
}

