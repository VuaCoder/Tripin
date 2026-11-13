import { createHash, randomBytes } from 'node:crypto';
import type { AgencyMemberRole, AgencyMemberStatus } from '../../generated/prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/app-error';
import { enqueueMail, kickMailOutbox } from '../notifications/mail-outbox';
import { env } from '../../config/env';
import { writeAudit } from '../audit/audit.writer';
import { agencyAccessInclude, AGENCY_PERMISSIONS as P, effectiveAgencyPermissions, type AgencyContext } from './agency.policy';
import { assertDelegable, bumpAgencyPermissions, lockAgencyAccess } from './agency-access.service';
import { buildAgencyInvitationMail } from './agency-invitation.mail';
import { agencyOwnershipSelect, primaryAgencyOwnerId, agencyOwnerLabel } from './agency-ownership';
import { joinOrRestoreAgencyMember } from './agency-rejoin';

const digest = (s: string) => createHash('sha256').update(s).digest('hex');
const memberInclude = { ...agencyAccessInclude, agency: { select: { ...agencyOwnershipSelect, id: true, companyName: true, verificationStatus: true, permissionVersion: true } } } as const;

/** Redact the local part of an email to `j***n@example.com` so it is never exposed to an unverified caller. */
function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 1) return email.length > 1 ? email[0] + '***' : email; // no usable domain → keep it vague
  const local = email.slice(0, at), domain = email.slice(at);
  const head = local[0];
  const tail = local.length > 2 ? local[local.length - 1] : '';
  const mid = '*'.repeat(Math.max(1, local.length - 1 - (tail ? 1 : 0)));
  return `${head}${mid}${tail}${domain}`;
}

export type InvitationValidateStatus = 'PENDING' | 'EXPIRED' | 'ACCEPTED' | 'REVOKED';

export class AgencyService {
  async listForUser(userId: string) {
    const rows = await prisma.agencyMember.findMany({
      where: { userId, status: 'ACTIVE' }, include: memberInclude, orderBy: { agencyId: 'asc' },
    });
    return rows.map(m => ({ agencyId: m.agencyId, memberId: m.id, memberRole: m.role,
      isPrimaryOwner: m.userId === primaryAgencyOwnerId(m.agency),
      companyName: m.agency.companyName, verificationStatus: m.agency.verificationStatus,
      roleId: m.roleId, roleName: m.role === 'OWNER' ? agencyOwnerLabel(m.userId === primaryAgencyOwnerId(m.agency)) : m.assignedRole?.name ?? m.role, permissionVersion: m.agency.permissionVersion,
      permissions: effectiveAgencyPermissions(m) }));
  }

  async resolve(userId: string, selected?: string): Promise<AgencyContext> {
    const memberships = await this.listForUser(userId);
    const m = selected ? memberships.find(x => x.agencyId === selected)
      : memberships.length === 1 ? memberships[0] : undefined;
    if (!m) throw AppError.forbidden(selected ? 'Agency membership is not active' : 'Select an agency with X-Agency-Id');
    return { agencyId: m.agencyId, actorUserId: userId, memberId: m.memberId,
      memberRole: m.memberRole, isPrimaryOwner: m.isPrimaryOwner, permissions: m.permissions, roleId: m.roleId, roleName: m.roleName, permissionVersion: m.permissionVersion };
  }

  async changeMember(ctx: AgencyContext, memberId: string, patch: { role?: AgencyMemberRole; status?: AgencyMemberStatus }) {
    return prisma.$transaction(async tx => {
      const actor = await lockAgencyAccess(tx, ctx, P.TEAM_MANAGE);
      const member = await tx.agencyMember.findFirst({ where: { id: memberId, agencyId: ctx.agencyId }, include: agencyAccessInclude });
      if (!member) throw AppError.notFound('Member not found');
      if (member.id === actor.id) throw AppError.forbidden('Cannot change your own membership status');
      const nextRole = patch.role ?? member.role, nextStatus = patch.status ?? member.status;
      const promoteOwner = member.role !== 'OWNER' && nextRole === 'OWNER';
      const primaryOwnerId = primaryAgencyOwnerId(actor.agency);
      if (member.userId === primaryOwnerId) throw AppError.forbidden('Không thể thay đổi vai trò hoặc trạng thái của owner.');
      if ((member.role === 'OWNER' || nextRole === 'OWNER') && (actor.role !== 'OWNER' || actor.userId !== primaryOwnerId)) {
        throw AppError.forbidden('Chỉ Owner được quản lý vai trò và trạng thái Co_Owner.');
      }
      // Ownership transitions reset staff overrides and remove former owner grants.
      const resetOverrides = promoteOwner || (member.role === 'OWNER' && nextRole !== 'OWNER');
      let nextRoleId = member.roleId;
      if (promoteOwner) {
        const recipient = await tx.user.findUnique({ where: { id: member.userId }, select: { status: true, staffStatus: true, emailVerifiedAt: true } });
        if (member.status !== 'ACTIVE' || nextStatus !== 'ACTIVE' || !recipient || recipient.status !== 'ACTIVE' || recipient.staffStatus !== 'ACTIVE' || !recipient.emailVerifiedAt) {
          throw AppError.conflict('Chỉ có thể thêm owner từ thành viên đang hoạt động với email đã xác minh.');
        }
      }
      if (patch.role !== undefined) {
        if (!effectiveAgencyPermissions(actor).includes(P.PERMISSIONS_MANAGE)) throw AppError.forbidden('Role changes require permission management');
        const role = await tx.agencyRole.findFirst({ where: { agencyId: ctx.agencyId, systemRole: nextRole } });
        if (!role) throw AppError.conflict('Default agency role is missing');
        nextRoleId = role.id;
        assertDelegable(actor, effectiveAgencyPermissions({ ...member, role: nextRole, assignedRole: role, ...(resetOverrides ? { permissionOverrides: [] } : {}) }));
      } else if (nextStatus === 'ACTIVE') assertDelegable(actor, effectiveAgencyPermissions(member));
      if (member.role === 'OWNER' && member.status === 'ACTIVE' && (nextRole !== 'OWNER' || nextStatus !== 'ACTIVE')) {
        const owners = await tx.agencyMember.count({ where: { agencyId: ctx.agencyId, role: 'OWNER', status: 'ACTIVE', user: { status: 'ACTIVE', staffStatus: 'ACTIVE' } } });
        if (owners <= 1) throw AppError.conflict('Cannot remove the last active OWNER');
      }
      // Ownership transitions start from a clean role template in either direction.
      if (resetOverrides) await tx.agencyMemberPermissionOverride.deleteMany({ where: { agencyId: ctx.agencyId, memberId: member.id } });
      const updated = await tx.agencyMember.update({ where: { id: member.id }, data: { ...patch, roleId: nextRoleId, updatedAt: new Date() } });
      // Removal/suspension invalidates earlier ways back in, not just current sessions.
      if (patch.status && nextStatus !== 'ACTIVE') {
        const recipient = await tx.user.findUniqueOrThrow({ where: { id: member.userId }, select: { email: true } });
        await tx.agencyInvitation.updateMany({ where: { agencyId: ctx.agencyId, email: { equals: recipient.email, mode: 'insensitive' }, status: 'PENDING' }, data: { status: 'REVOKED', revokedAt: new Date() } });
        await tx.agencyJoinRequest.updateMany({ where: { agencyId: ctx.agencyId, userId: member.userId, status: 'PENDING' }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
      }
      await bumpAgencyPermissions(tx, ctx.agencyId);
      await writeAudit(tx, { actorId: ctx.actorUserId, actorRole: actor.user.role, action: 'agency.member_changed', targetType: 'agency-member', targetId: member.id,
        metadata: { agencyId: ctx.agencyId, before: { role: member.role, status: member.status }, after: { role: updated.role, status: updated.status },
          ...(resetOverrides ? { clearedPermissionOverrideCount: member.permissionOverrides.length } : {}) } });
      return updated;
    });
  }

  async invite(ctx: AgencyContext, input: { email: string; role: Exclude<AgencyMemberRole, 'OWNER'>; roleId?: string }) {
    const token = randomBytes(32).toString('hex');
    const email = input.email.trim().toLowerCase();
    const invitation = await prisma.$transaction(async tx => {
      const actor = await lockAgencyAccess(tx, ctx, P.TEAM_INVITE);
      const role = await tx.agencyRole.findFirst({ where: { agencyId: ctx.agencyId, ...(input.roleId ? { id: input.roleId } : { systemRole: input.role }) } });
      if (!role || role.systemRole === 'OWNER') throw AppError.badRequest('Select a non-OWNER role in this agency');
      assertDelegable(actor, role.permissions);
      const existingUser = await tx.user.findUnique({ where: { email } });
      const existingMember = existingUser ? await tx.agencyMember.findUnique({ where: { agencyId_userId: { agencyId: ctx.agencyId, userId: existingUser.id } } }) : null;
      if (existingMember?.status === 'ACTIVE') throw AppError.conflict('Tài khoản này đã là thành viên của doanh nghiệp.');
      if (existingMember?.status === 'SUSPENDED') throw AppError.conflict('Thành viên đang bị đình chỉ. Hãy kích hoạt lại trong hồ sơ nhân viên trước khi mời.');
      if (existingMember?.role === 'OWNER' && actor.userId !== primaryAgencyOwnerId(actor.agency)) throw AppError.forbidden('Chỉ Owner được mời lại Co_Owner đã bị gỡ.');
      if (existingMember?.status === 'REMOVED') {
        await tx.agencyInvitation.updateMany({ where: { agencyId: ctx.agencyId, email, status: 'PENDING', createdAt: { lt: existingMember.updatedAt } }, data: { status: 'REVOKED', revokedAt: new Date() } });
      }
      // Retire expired pending entries before creating the next unique invitation.
      await tx.agencyInvitation.updateMany({ where: { agencyId: ctx.agencyId, email, status: 'PENDING', expiresAt: { lte: new Date() } }, data: { status: 'EXPIRED' } });
      const pending = await tx.agencyInvitation.findFirst({ where: { agencyId: ctx.agencyId, email, status: 'PENDING' } });
      if (pending) throw AppError.conflict('Email này đã có lời mời còn hiệu lực tại doanh nghiệp.');
      const row = await tx.agencyInvitation.create({ data: { agencyId: ctx.agencyId, email, role: role.systemRole ?? 'STAFF', roleId: role.id,
        tokenHash: digest(token), invitedByUserId: ctx.actorUserId, createdAt: new Date(), expiresAt: new Date(Date.now() + 86400000) } });
      const agency = await tx.agencyProfile.findUniqueOrThrow({ where: { id: ctx.agencyId }, select: { companyName: true } });
      const mail = buildAgencyInvitationMail(agency.companyName ?? 'Doanh nghiệp', role.name, row.expiresAt);
      await enqueueMail(tx, 'agency-invitation:' + row.id, email, mail.subject, mail.text);
      await writeAudit(tx, { actorId: ctx.actorUserId, actorRole: actor.user.role, action: 'agency.invitation_created', targetType: 'agency-invitation', targetId: row.id,
        metadata: { agencyId: ctx.agencyId, role: row.role } });
      return row;
    });
    if (env.NODE_ENV !== 'test') kickMailOutbox();
    // Neither raw token nor its hash is returned by the API.
    return { id: invitation.id, email: invitation.email, role: invitation.role, roleId: invitation.roleId, expiresAt: invitation.expiresAt, status: invitation.status };
  }

  async accept(userId: string, token: string) {
    return this.acceptInvitation(userId, { tokenHash: digest(token) });
  }

  async myInvitations(userId: string, page = 1) {
    return prisma.$transaction(async tx => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || user.status !== 'ACTIVE' || user.staffStatus !== 'ACTIVE' || !user.emailVerifiedAt) {
        throw AppError.forbidden('Vui lòng xác minh email và dùng tài khoản đang hoạt động.');
      }
      const where = { email: user.email.trim().toLowerCase(), status: 'PENDING' as const, expiresAt: { gt: new Date() } };
      const total = await tx.agencyInvitation.count({ where });
      const rows = await tx.agencyInvitation.findMany({ where, skip: (page - 1) * 20, take: 20,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true, agency: { select: { id: true, companyName: true } }, assignedRole: { select: { name: true } }, role: true, createdAt: true, expiresAt: true },
      });
      const labels = { OWNER: 'Chủ doanh nghiệp', MANAGER: 'Quản lý', STAFF: 'Nhân viên', ACCOUNTANT: 'Kế toán' };
      return { items: rows.map(({ assignedRole, role, ...row }) => ({ ...row, roleName: assignedRole?.name ?? labels[role] })), page, pageSize: 20, total };
    }, { isolationLevel: 'RepeatableRead' });
  }

  async acceptById(userId: string, invitationId: string) {
    const member = await this.acceptInvitation(userId, { id: invitationId });
    return { invitationId, agencyId: member.agencyId, memberId: member.id };
  }

  private async acceptInvitation(userId: string, lookup: { id: string } | { tokenHash: string }) {
    return prisma.$transaction(async tx => {
      const recipient = await tx.user.findUnique({ where: { id: userId } });
      if (!recipient || recipient.status !== 'ACTIVE' || recipient.staffStatus !== 'ACTIVE' || !recipient.emailVerifiedAt) {
        throw AppError.forbidden('Vui lòng xác minh email và dùng tài khoản đang hoạt động.');
      }
      const email = recipient.email.trim().toLowerCase();
      const hint = await tx.agencyInvitation.findFirst({ where: { ...lookup, email }, select: { id: true, agencyId: true } });
      if (!hint) {
        if ('id' in lookup) throw AppError.notFound('Không tìm thấy lời mời.');
        throw AppError.badRequest('Invitation is invalid or expired');
      }
      await tx.$queryRaw`SELECT id FROM "AgencyProfile" WHERE id=${hint.agencyId}::uuid FOR UPDATE`;
      // Re-read identity after any wait for the agency lock, as on the legacy path.
      const user = await tx.user.findUnique({ where: { id: userId } });
      const inv = await tx.agencyInvitation.findUnique({ where: { id: hint.id }, include: { assignedRole: true } });
      if (!user || user.status !== 'ACTIVE' || user.staffStatus !== 'ACTIVE' || !user.emailVerifiedAt ||
        !inv || inv.status !== 'PENDING' || inv.expiresAt <= new Date() || user.email.trim().toLowerCase() !== inv.email) {
        if ('id' in lookup) throw AppError.conflict('Lời mời đã hết hạn, bị thu hồi hoặc đã được xử lý. Hãy tải lại danh sách.');
        throw AppError.badRequest('Invitation is invalid or expired');
      }
      const inviter = await tx.agencyMember.findUnique({ where: { agencyId_userId: { agencyId: inv.agencyId, userId: inv.invitedByUserId } }, include: { ...agencyAccessInclude, agency: { select: agencyOwnershipSelect }, user: { select: { status: true, staffStatus: true } } } });
      if (!inviter || inviter.status !== 'ACTIVE' || inviter.user.status !== 'ACTIVE' || inviter.user.staffStatus !== 'ACTIVE' || !effectiveAgencyPermissions(inviter).includes(P.TEAM_INVITE) || !inv.assignedRole || inv.assignedRole.systemRole === 'OWNER') {
        throw AppError.forbidden('Invitation sender no longer has permission');
      }
      assertDelegable(inviter, inv.assignedRole.permissions);
      const member = await joinOrRestoreAgencyMember(tx, inv.agencyId, userId, inv.assignedRole, inviter, inv.createdAt);
      // Joining through email closes a concurrent code request, without overriding an existing role.
      await tx.agencyJoinRequest.updateMany({ where: { agencyId: inv.agencyId, userId, status: 'PENDING' }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
      await bumpAgencyPermissions(tx, inv.agencyId);
      await tx.agencyInvitation.update({ where: { id: inv.id }, data: { status: 'ACCEPTED', acceptedAt: new Date(), acceptedByUserId: userId } });
      await writeAudit(tx, { actorId: userId, actorRole: user.role, action: 'agency.invitation_accepted', targetType: 'agency-member', targetId: member.id, metadata: { agencyId: inv.agencyId } });
      return member;
    });
  }

  /**
   * Public, pre-accept validation of an invitation token. Only safe metadata is returned:
   * never the raw token or its hash. The invited email is redacted unless `emailHint` matches
   * (case-insensitive), so the accept page can confirm the signing-in user is the invitee.
   */
  async validateInvitationToken(token: string, emailHint?: string): Promise<{
    status: InvitationValidateStatus;
    email: string;
    emailMatched: boolean;
    role: AgencyMemberRole;
    expiresAt: Date;
    agencyName: string | null;
  }> {
    const hint = await prisma.agencyInvitation.findUnique({
      where: { tokenHash: digest(token) },
      select: { email: true, role: true, status: true, expiresAt: true, agency: { select: { companyName: true } } },
    });
    if (!hint) throw AppError.notFound('Invitation not found');
    const expired = hint.status === 'EXPIRED' || hint.expiresAt <= new Date();
    const status: InvitationValidateStatus = expired ? 'EXPIRED'
      : hint.status === 'ACCEPTED' ? 'ACCEPTED' : hint.status === 'REVOKED' ? 'REVOKED' : 'PENDING';
    const emailMatched = emailHint !== undefined && hint.email === emailHint.toLowerCase();
    return {
      status,
      email: emailMatched ? hint.email : maskEmail(hint.email),
      emailMatched,
      role: hint.role,
      expiresAt: hint.expiresAt,
      agencyName: hint.agency.companyName,
    };
  }

  async revoke(ctx: AgencyContext, invitationId: string) {
    return prisma.$transaction(async tx => {
      const actor = await lockAgencyAccess(tx, ctx, P.TEAM_MANAGE);
      const result = await tx.agencyInvitation.updateMany({ where: { id: invitationId, agencyId: ctx.agencyId, status: 'PENDING' }, data: { status: 'REVOKED', revokedAt: new Date() } });
      if (!result.count) throw AppError.notFound('Pending invitation not found');
      await writeAudit(tx, { actorId: actor.userId, actorRole: actor.user.role, action: 'agency.invitation_revoked', targetType: 'agency-invitation', targetId: invitationId, metadata: { agencyId: ctx.agencyId } });
      return { revoked: true };
    });
  }
}
export const agencyService = new AgencyService();
export type AgencyMembershipDto = Awaited<ReturnType<AgencyService['listForUser']>>[number];
