import { PERMISSIONS } from '@travel-platform/constants';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/app-error';
import { writeAudit } from '../audit/audit.writer';
import { AGENCY_EDITABLE_STATUSES } from '../tours/tours.types';
import { lockAgencyAccess, bumpAgencyPermissions } from './agency-access.service';
import { primaryAgencyOwnerId } from './agency-ownership';
import { AGENCY_PERMISSIONS as P, effectiveAgencyPermissions, type AgencyContext } from './agency.policy';

export const SCOPED_TOUR_FIELDS = ['title','summary','description'] as const;
type ContentPatch = { title?: string; summary?: string; description?: string };
export class AgencyWorkService {
  async setTourScopes(ctx: AgencyContext, memberId: string, scopes: { tourId: string; allowedFields: string[] }[]) {
    return prisma.$transaction(async tx => {
      const actor = await lockAgencyAccess(tx, ctx, P.PERMISSIONS_MANAGE);
      if (!effectiveAgencyPermissions(actor).includes(PERMISSIONS.TOUR_UPDATE_OWN)) throw AppError.forbidden('Full tour editing permission is required to delegate tour scope');
      const target = await tx.agencyMember.findFirst({ where: { id: memberId, agencyId: ctx.agencyId } });
      if (!target) throw AppError.notFound('Member not found');
      if (target.role === 'OWNER' || target.userId === primaryAgencyOwnerId(actor.agency)) throw AppError.forbidden('Không thể chỉnh phạm vi quyền của chủ doanh nghiệp.');
      if (actor.role !== 'OWNER' && target.id === actor.id) throw AppError.forbidden('Cannot modify yourself');
      const ids = scopes.map(s => s.tourId);
      if (new Set(ids).size !== ids.length || scopes.some(s => s.allowedFields.some(f => !(SCOPED_TOUR_FIELDS as readonly string[]).includes(f)))) throw AppError.badRequest('Invalid tour scopes');
      if (await tx.tour.count({ where: { agencyId: ctx.agencyId, id: { in: ids } } }) !== ids.length) throw AppError.notFound('Tour not found in selected agency');
      const before = await tx.agencyMemberTourScope.findMany({ where: { agencyId: ctx.agencyId, memberId } });
      await tx.agencyMemberTourScope.deleteMany({ where: { agencyId: ctx.agencyId, memberId } });
      if (scopes.length) await tx.agencyMemberTourScope.createMany({ data: scopes.map(s => ({ agencyId: ctx.agencyId, memberId, ...s })) });
      await bumpAgencyPermissions(tx, ctx.agencyId);
      await writeAudit(tx, { actorId: actor.userId, actorRole: actor.user.role, action: 'agency.tour_scope_changed', targetType: 'agency-member', targetId: memberId,
        metadata: { agencyId: ctx.agencyId, before: before.map(s => ({ tourId: s.tourId, allowedFields: s.allowedFields })), after: scopes } });
      return { memberId, scopes };
    });
  }

  async updateScopedContent(ctx: AgencyContext, tourId: string, patch: ContentPatch) {
    return prisma.$transaction(async tx => {
      const actor = await lockAgencyAccess(tx, ctx, P.TOUR_CONTENT_UPDATE);
      const fields = Object.keys(patch);
      if (!fields.length || fields.some(f => !(SCOPED_TOUR_FIELDS as readonly string[]).includes(f))) throw AppError.badRequest('Only title, summary and description can be changed');
      const scope = await tx.agencyMemberTourScope.findUnique({ where: { memberId_tourId: { memberId: actor.id, tourId } } });
      if (!effectiveAgencyPermissions(actor).includes(PERMISSIONS.TOUR_UPDATE_OWN) &&
        (!scope || scope.agencyId !== ctx.agencyId || fields.some(f => !scope.allowedFields.includes(f)))) throw AppError.forbidden('Tour or fields are not assigned to this member');
      const tour = await tx.tour.findFirst({ where: { id: tourId, agencyId: ctx.agencyId } });
      if (!tour) throw AppError.notFound('Tour not found');
      if (!AGENCY_EDITABLE_STATUSES.includes(tour.status)) throw AppError.conflict('Tour is locked for editing', 'TOUR_LOCKED');
      const result = await tx.tour.updateMany({ where: { id: tour.id, agencyId: ctx.agencyId, status: tour.status, updatedAt: tour.updatedAt }, data: patch });
      if (!result.count) throw AppError.conflict('Tour changed; please retry', 'CONCURRENT_UPDATE');
      await writeAudit(tx, { actorId: actor.userId, actorRole: actor.user.role, action: 'agency.tour_content_changed', targetType: 'tour', targetId: tourId,
        metadata: { agencyId: ctx.agencyId, fields } });
      return { id: tour.id, ...patch };
    });
  }
}
export const agencyWorkService = new AgencyWorkService();
