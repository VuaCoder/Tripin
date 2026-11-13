import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ROLES, type PersistedRole, type Permission } from '@travel-platform/constants';
import { AppError } from '../utils/app-error';
import type { UserActor } from '../types/actor';
import type { AgencyPermission } from '../modules/agencies/agency.policy';

/** Metadata attached to guard middlewares so the route table (docs + audit tests) can tell who may call what. */
export const GUARD_META = Symbol.for('travel.guard');
export type GuardMeta =
  | { kind: 'auth' }
  | { kind: 'permission'; permissions: AgencyPermission[] }
  | { kind: 'any_permission'; permissions: AgencyPermission[] }
  | { kind: 'role'; role: PersistedRole };

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
    const granted = req.agencyContext?.permissions ?? req.actor.permissions;
    if (!permissions.every((permission) => granted.includes(permission))) return next(AppError.forbidden());
    next();
  }, { kind: 'permission', permissions });
}

/**
 * Requires AT LEAST ONE of the listed permissions.
 */
export function requireAnyPermission(...permissions: Permission[]): RequestHandler {
  return tag((req, _res, next) => {
    if (req.actor.kind !== 'user') return next(AppError.unauthenticated());
    const granted = req.agencyContext?.permissions ?? req.actor.permissions;
    if (!permissions.some((permission) => granted.includes(permission))) return next(AppError.forbidden());
    next();
  }, { kind: 'any_permission', permissions });
}

/** Platform administration cannot be delegated through extraPermissions. */
export const requireSuperAdmin: RequestHandler = tag((req, _res, next) => {
  if (req.actor.kind !== 'user') return next(AppError.unauthenticated());
  if (req.actor.role !== ROLES.SUPER_ADMIN) return next(AppError.forbidden('Only Super Admin can administer the platform'));
  next();
}, { kind: 'role', role: ROLES.SUPER_ADMIN });

/** Booking create boundary: actor must be an ACTIVE TRAVELER with a verified email (BOOK-007 / BOOK-011). */
export const requireVerifiedTraveler: RequestHandler = tag((req, _res, next) => {
  if (req.actor.kind !== 'user') return next(AppError.unauthenticated());
  if (req.actor.role !== ROLES.TRAVELER) {
    return next(AppError.forbidden('Only travelers can create bookings'));
  }
  if (!req.actor.emailVerified) {
    return next(AppError.forbidden('Please verify your email before booking', 'ACCOUNT_NOT_VERIFIED'));
  }
  next();
}, { kind: 'role', role: ROLES.TRAVELER });

/** Typed access to the logged-in actor inside controllers behind `requireAuth` / `requirePermission`. */
export function userActor(req: Request): UserActor {
  if (req.actor.kind !== 'user') throw AppError.unauthenticated();
  return req.actor;
}

