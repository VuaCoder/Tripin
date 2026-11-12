import type { Request, RequestHandler } from 'express';
import { prisma } from '../config/database';
import { agencyService } from '../modules/agencies/agency.service';
import type { AgencyContext, AgencyPermission } from '../modules/agencies/agency.policy';
import { AppError } from '../utils/app-error';
import { userActor, GUARD_META, type GuardMeta } from './authorize';

export const resolveAgencyContext: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.agencyContext) {
      const actor = userActor(req);
      const header = req.get('X-Agency-Id');
      if (header && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(header)) throw AppError.badRequest('X-Agency-Id must be a UUID');
      req.agencyContext = await agencyService.resolve(actor.userId, header);
    }
    next();
  } catch (e) { next(e); }
};
export function agencyContext(req: Request): AgencyContext {
  if (!req.agencyContext) throw AppError.forbidden('Agency context required');
  return req.agencyContext;
}
export function requireAgencyPermission(permission: AgencyPermission): RequestHandler {
  const handler: RequestHandler = (req, _res, next) => {
    if (!req.agencyContext?.permissions.includes(permission)) return next(AppError.forbidden());
    next();
  };
  (handler as unknown as Record<symbol, GuardMeta>)[GUARD_META] = { kind: 'permission', permissions: [permission] };
  return handler;
}
export const requireVerifiedAgency: RequestHandler = async (req, _res, next) => {
  try {
    const profile = await prisma.agencyProfile.findUnique({ where: { id: agencyContext(req).agencyId } });
    if (profile?.verificationStatus !== 'VERIFIED') throw AppError.forbidden('Agency must be verified');
    next();
  } catch (e) { next(e); }
};
/** Fail closed until each legacy service separates tenant, actor and recipients. */
export const requireLegacyOwnerIntegration: RequestHandler = (req, _res, next) => {
  const ctx = agencyContext(req);
  if (ctx.memberRole !== 'OWNER' || ctx.agencyId !== ctx.actorUserId) return next(AppError.forbidden('This module is awaiting membership integration'));
  next();
};
