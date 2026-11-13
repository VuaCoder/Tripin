import { prisma, type DbExecutor } from '../../config/database';
import { AppError } from '../../utils/app-error';
import { writeAudit } from '../audit/audit.writer';
import { agencyOwnershipSelect, primaryAgencyOwnerId } from './agency-ownership';
import { agencyAccessInclude, AGENCY_PERMISSION_CATALOG, AGENCY_PERMISSIONS as P,
  effectiveAgencyPermissions, OWNER_CONTROL_PERMISSIONS, type AgencyContext, type AgencyPermission } from './agency.policy';

/** Serialize all permission/team writers and re-check authority after waiting for the lock. */
export async function lockAgencyAccess(tx: DbExecutor, ctx: AgencyContext, permission: AgencyPermission) {
  await tx.$queryRaw`SELECT id FROM "AgencyProfile" WHERE id=${ctx.agencyId}::uuid FOR UPDATE`;
  const member = await tx.agencyMember.findUnique({
    where: { agencyId_userId: { agencyId: ctx.agencyId, userId: ctx.actorUserId } },
    include: { ...agencyAccessInclude, user: true, agency: { select: agencyOwnershipSelect } },
  });
  if (!member || member.id !== ctx.memberId || member.status !== 'ACTIVE' || member.user.status !== 'ACTIVE' ||
    member.user.staffStatus !== 'ACTIVE' || !effectiveAgencyPermissions(member).includes(permission)) {
    throw AppError.forbidden('Agency permissions changed');
  }
  return member;
}

export function assertDelegable(actor: Parameters<typeof effectiveAgencyPermissions>[0], permissions: readonly string[]) {
  const held = new Set<string>(effectiveAgencyPermissions(actor));
  if (permissions.some(p => !held.has(p))) throw AppError.forbidden('Cannot grant permissions you do not hold');
}

export async function bumpAgencyPermissions(tx: DbExecutor, agencyId: string) {
  await tx.agencyProfile.update({ where: { id: agencyId }, data: { permissionVersion: { increment: 1 } } });
}

export class AgencyAccessService {
  listRoles(ctx: AgencyContext) {
    return prisma.agencyRole.findMany({ where: { agencyId: ctx.agencyId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  }

  async saveRole(ctx: AgencyContext, input: { name: string; permissions: string[] }, roleId?: string) {
    return prisma.$transaction(async tx => {
      const actor = await lockAgencyAccess(tx, ctx, P.PERMISSIONS_MANAGE);
      const before = roleId ? await tx.agencyRole.findFirst({ where: { id: roleId, agencyId: ctx.agencyId } }) : null;
      if (roleId && !before) throw AppError.notFound('Role not found');
      if (before && (before.id === actor.roleId || before.systemRole === actor.role)) throw AppError.forbidden('Cannot change the role assigned to your own membership');
      const permissions = [...new Set(input.permissions)].sort();
      if (permissions.some(p => !AGENCY_PERMISSION_CATALOG.includes(p as AgencyPermission))) throw AppError.badRequest('Unknown or reserved agency permission');
      if (!permissions.includes(P.CONTEXT_VIEW)) throw AppError.badRequest('Agency context access is required');
      if (before?.systemRole === 'OWNER' && OWNER_CONTROL_PERMISSIONS.some(p => !permissions.includes(p))) {
        throw AppError.badRequest('OWNER recovery permissions cannot be removed');
      }
      assertDelegable(actor, permissions);
      if (actor.role !== 'OWNER' && before?.systemRole === 'OWNER') {
        throw AppError.forbidden('Cannot edit your own role or an OWNER role');
      }
      const duplicate = await tx.agencyRole.findFirst({ where: { agencyId: ctx.agencyId, name: input.name, ...(roleId ? { id: { not: roleId } } : {}) } });
      if (duplicate) throw AppError.conflict('Role name already exists');
      const data = { name: input.name, permissions, updatedAt: new Date() };
      const saved = before ? await tx.agencyRole.update({ where: { id: before.id }, data })
        : await tx.agencyRole.create({ data: { agencyId: ctx.agencyId, ...data } });
      await bumpAgencyPermissions(tx, ctx.agencyId);
      await writeAudit(tx, { actorId: actor.userId, actorRole: actor.user.role, action: 'agency.role_saved', targetType: 'agency-role', targetId: saved.id,
        metadata: { agencyId: ctx.agencyId, before: before ? { name: before.name, permissions: before.permissions } : null, after: data } });
      return saved;
    });
  }

  async setMemberAccess(ctx: AgencyContext, memberId: string, input: { roleId: string; overrides: { permission: string; effect: 'ALLOW' | 'DENY' }[] }) {
    return prisma.$transaction(async tx => {
      const actor = await lockAgencyAccess(tx, ctx, P.PERMISSIONS_MANAGE);
      const member = await tx.agencyMember.findFirst({ where: { id: memberId, agencyId: ctx.agencyId }, include: agencyAccessInclude });
      const role = await tx.agencyRole.findFirst({ where: { id: input.roleId, agencyId: ctx.agencyId } });
      if (!member || !role) throw AppError.notFound('Member or role not found');
      if (member.id === actor.id) throw AppError.forbidden('Cannot change your own membership access');
      // Owners share the full template. Only the primary owner may downgrade a
      // co-owner, through changeMember; per-member overrides cannot bypass this.
      if (member.role === 'OWNER' || member.userId === primaryAgencyOwnerId(actor.agency)) {
        throw AppError.forbidden('Quyền của chủ doanh nghiệp không chỉnh riêng. Owner có thể đổi vai trò Co_Owner.');
      }
      // Ownership is changed only through the last-OWNER-protected membership workflow.
      if (role.systemRole === 'OWNER') throw AppError.forbidden('Use the ownership workflow to change OWNER identity');
      if (new Set(input.overrides.map(o => o.permission)).size !== input.overrides.length || input.overrides.some(o =>
        !AGENCY_PERMISSION_CATALOG.includes(o.permission as AgencyPermission) || o.permission === P.CONTEXT_VIEW)) {
        throw AppError.badRequest('Invalid permission overrides');
      }
      const next = { role: member.role, assignedRole: role, permissionOverrides: input.overrides };
      assertDelegable(actor, effectiveAgencyPermissions(next));
      // Clearing a DENY is a grant too; validate final effective access above, not just ALLOW rows.
      await tx.agencyMemberPermissionOverride.deleteMany({ where: { agencyId: ctx.agencyId, memberId } });
      if (input.overrides.length) await tx.agencyMemberPermissionOverride.createMany({ data: input.overrides.map(o => ({ agencyId: ctx.agencyId, memberId, ...o })) });
      await tx.agencyMember.update({ where: { id: memberId }, data: { roleId: role.id, role: role.systemRole ?? 'STAFF', updatedAt: new Date() } });
      await bumpAgencyPermissions(tx, ctx.agencyId);
      await writeAudit(tx, { actorId: actor.userId, actorRole: actor.user.role, action: 'agency.member_access_changed', targetType: 'agency-member', targetId: memberId,
        metadata: { agencyId: ctx.agencyId, before: { roleId: member.roleId, overrides: member.permissionOverrides.map(o => ({ permission: o.permission, effect: o.effect })) }, after: input } });
      return { memberId, roleId: role.id, permissions: effectiveAgencyPermissions(next) };
    });
  }
}
export const agencyAccessService = new AgencyAccessService();
