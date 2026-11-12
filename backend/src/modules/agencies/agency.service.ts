import { createHash, randomBytes } from 'node:crypto';
import type { AgencyMemberRole, AgencyMemberStatus } from '../../generated/prisma/client';
import { prisma, type DbExecutor } from '../../config/database';
import { AppError } from '../../utils/app-error';
import { enqueueMail, kickMailOutbox } from '../notifications/mail-outbox';
import { env } from '../../config/env';
import { writeAudit } from '../audit/audit.writer';
import { AGENCY_ROLE_PERMISSIONS, type AgencyContext } from './agency.policy';

const digest = (s: string) => createHash('sha256').update(s).digest('hex');
const memberInclude = { agency: { select: { id: true, companyName: true, verificationStatus: true } } } as const;

export class AgencyService {
  async listForUser(userId: string) {
    const rows = await prisma.agencyMember.findMany({
      where: { userId, status: 'ACTIVE' }, include: memberInclude, orderBy: { agencyId: 'asc' },
    });
    return rows.map(m => ({ agencyId: m.agencyId, memberId: m.id, memberRole: m.role,
      companyName: m.agency.companyName, verificationStatus: m.agency.verificationStatus,
      permissions: AGENCY_ROLE_PERMISSIONS[m.role] }));
  }

  async resolve(userId: string, selected?: string): Promise<AgencyContext> {
    const memberships = await this.listForUser(userId);
    const m = selected ? memberships.find(x => x.agencyId === selected)
      : memberships.length === 1 ? memberships[0] : undefined;
    if (!m) throw AppError.forbidden(selected ? 'Agency membership is not active' : 'Select an agency with X-Agency-Id');
    return { agencyId: m.agencyId, actorUserId: userId, memberId: m.memberId,
      memberRole: m.memberRole, permissions: m.permissions };
  }

  private async lockAndAuthorize(tx: DbExecutor, ctx: AgencyContext, ownerOnly: boolean) {
    // All team/invitation writers take the same per-agency row lock. Re-read access
    // after acquiring it so a waiting manager cannot retain revoked privileges.
    await tx.$queryRaw`SELECT id FROM "AgencyProfile" WHERE id=${ctx.agencyId}::uuid FOR UPDATE`;
    const actor = await tx.agencyMember.findUnique({ where: { agencyId_userId: { agencyId: ctx.agencyId, userId: ctx.actorUserId } } });
    if (!actor || actor.status !== 'ACTIVE' || (ownerOnly ? actor.role !== 'OWNER' : !['OWNER', 'MANAGER'].includes(actor.role))) {
      throw AppError.forbidden('Team access changed');
    }
    const user = await tx.user.findUnique({ where: { id: ctx.actorUserId } });
    if (!user || user.status !== 'ACTIVE' || user.staffStatus !== 'ACTIVE') throw AppError.forbidden();
    return { member: actor, user };
  }

  async changeMember(ctx: AgencyContext, memberId: string, patch: { role?: AgencyMemberRole; status?: AgencyMemberStatus }) {
    return prisma.$transaction(async tx => {
      const actor = await this.lockAndAuthorize(tx, ctx, true);
      const member = await tx.agencyMember.findFirst({ where: { id: memberId, agencyId: ctx.agencyId } });
      if (!member) throw AppError.notFound('Member not found');
      const nextRole = patch.role ?? member.role, nextStatus = patch.status ?? member.status;
      if (member.role === 'OWNER' && member.status === 'ACTIVE' && (nextRole !== 'OWNER' || nextStatus !== 'ACTIVE')) {
        const owners = await tx.agencyMember.count({ where: { agencyId: ctx.agencyId, role: 'OWNER', status: 'ACTIVE', user: { status: 'ACTIVE', staffStatus: 'ACTIVE' } } });
        if (owners <= 1) throw AppError.conflict('Cannot remove the last active OWNER');
      }
      const updated = await tx.agencyMember.update({ where: { id: member.id }, data: patch });
      await writeAudit(tx, { actorId: ctx.actorUserId, actorRole: actor.user.role, action: 'agency.member_changed', targetType: 'agency-member', targetId: member.id,
        metadata: { agencyId: ctx.agencyId, before: { role: member.role, status: member.status }, after: { role: updated.role, status: updated.status } } });
      return updated;
    });
  }

  async invite(ctx: AgencyContext, input: { email: string; role: Exclude<AgencyMemberRole, 'OWNER'> }) {
    const token = randomBytes(32).toString('hex');
    const email = input.email.trim().toLowerCase();
    const invitation = await prisma.$transaction(async tx => {
      const actor = await this.lockAndAuthorize(tx, ctx, false);
      if (actor.member.role === 'MANAGER' && input.role !== 'STAFF') throw AppError.forbidden('Managers may invite STAFF only');
      // Retire expired pending entries before creating the next unique invitation.
      await tx.agencyInvitation.updateMany({ where: { agencyId: ctx.agencyId, email, status: 'PENDING', expiresAt: { lte: new Date() } }, data: { status: 'EXPIRED' } });
      const pending = await tx.agencyInvitation.findFirst({ where: { agencyId: ctx.agencyId, email, status: 'PENDING' } });
      if (pending) throw AppError.conflict('A pending invitation already exists');
      const existingUser = await tx.user.findUnique({ where: { email } });
      if (existingUser && await tx.agencyMember.findFirst({ where: { agencyId: ctx.agencyId, userId: existingUser.id, status: 'ACTIVE' } })) {
        throw AppError.conflict('User is already an active member');
      }
      const row = await tx.agencyInvitation.create({ data: { agencyId: ctx.agencyId, email, role: input.role,
        tokenHash: digest(token), invitedByUserId: ctx.actorUserId, expiresAt: new Date(Date.now() + 86400000) } });
      const url = (env.CLIENT_URL.split(',')[0] ?? '').replace(/\/$/, '') + '/agency/invitations/accept?token=' + token;
      await enqueueMail(tx, 'agency-invitation:' + row.id, email, 'Agency invitation', 'Accept your agency invitation: ' + url);
      await writeAudit(tx, { actorId: ctx.actorUserId, actorRole: actor.user.role, action: 'agency.invitation_created', targetType: 'agency-invitation', targetId: row.id,
        metadata: { agencyId: ctx.agencyId, role: row.role } });
      return row;
    });
    if (env.NODE_ENV !== 'test') kickMailOutbox();
    // Neither raw token nor its hash is returned by the API.
    return { id: invitation.id, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt, status: invitation.status };
  }

  async accept(userId: string, token: string) {
    return prisma.$transaction(async tx => {
      const hint = await tx.agencyInvitation.findUnique({ where: { tokenHash: digest(token) } });
      if (!hint) throw AppError.badRequest('Invitation is invalid or expired');
      await tx.$queryRaw`SELECT id FROM "AgencyProfile" WHERE id=${hint.agencyId}::uuid FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: userId } });
      const inv = await tx.agencyInvitation.findUnique({ where: { id: hint.id } });
      if (!user || user.status !== 'ACTIVE' || user.staffStatus !== 'ACTIVE' || !user.emailVerifiedAt ||
        !inv || inv.status !== 'PENDING' || inv.expiresAt <= new Date() || user.email.toLowerCase() !== inv.email) {
        throw AppError.badRequest('Invitation is invalid or expired');
      }
      // Suspension/removal can only be reversed by an OWNER, not an invitation.
      const old = await tx.agencyMember.findUnique({ where: { agencyId_userId: { agencyId: inv.agencyId, userId } } });
      if (old) throw AppError.conflict('Existing membership must be managed by an OWNER');
      const inviter = await tx.agencyMember.findUnique({ where: { agencyId_userId: { agencyId: inv.agencyId, userId: inv.invitedByUserId } }, include: { user: { select: { status: true, staffStatus: true } } } });
      if (!inviter || inviter.status !== 'ACTIVE' || inviter.user.status !== 'ACTIVE' || inviter.user.staffStatus !== 'ACTIVE' || !['OWNER', 'MANAGER'].includes(inviter.role) || (inviter.role === 'MANAGER' && inv.role !== 'STAFF')) {
        throw AppError.forbidden('Invitation sender no longer has permission');
      }
      const member = await tx.agencyMember.create({ data: { agencyId: inv.agencyId, userId, role: inv.role } });
      await tx.agencyInvitation.update({ where: { id: inv.id }, data: { status: 'ACCEPTED', acceptedAt: new Date(), acceptedByUserId: userId } });
      await writeAudit(tx, { actorId: userId, actorRole: user.role, action: 'agency.invitation_accepted', targetType: 'agency-member', targetId: member.id, metadata: { agencyId: inv.agencyId } });
      return member;
    });
  }

  async revoke(ctx: AgencyContext, invitationId: string) {
    return prisma.$transaction(async tx => {
      await this.lockAndAuthorize(tx, ctx, true);
      const result = await tx.agencyInvitation.updateMany({ where: { id: invitationId, agencyId: ctx.agencyId, status: 'PENDING' }, data: { status: 'REVOKED', revokedAt: new Date() } });
      if (!result.count) throw AppError.notFound('Pending invitation not found');
      return { revoked: true };
    });
  }
}
export const agencyService = new AgencyService();
export type AgencyMembershipDto = Awaited<ReturnType<AgencyService['listForUser']>>[number];
