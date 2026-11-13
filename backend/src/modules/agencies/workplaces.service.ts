import { createHash, randomBytes } from 'node:crypto';
import { prisma, type DbExecutor } from '../../config/database';
import { AppError } from '../../utils/app-error';
import { writeAudit } from '../audit/audit.writer';
import { writeNotification } from '../notifications/notifications.writer';
import { AGENCY_PERMISSIONS as P, effectiveAgencyPermissions, type AgencyContext } from './agency.policy';
import { assertDelegable, bumpAgencyPermissions, lockAgencyAccess } from './agency-access.service';
import { joinOrRestoreAgencyMember } from './agency-rejoin';

export const JOIN_CODE_TTL_MS = 15 * 60 * 1000;
export const normalizeJoinCode = (code: string) => code.replace(/[\s-]/g, '').toUpperCase();
const hash = (code: string) => createHash('sha256').update(normalizeJoinCode(code)).digest('hex');
export type AgencyApplicationInput = {
  companyName: string; address?: string; licenseNumber?: string; taxId?: string;
  businessLicenseUrl?: string; description?: string; website?: string;
};
const requestSelect = { id: true, agencyId: true, status: true, createdAt: true, reviewedAt: true,
  agency: { select: { companyName: true } } } as const;

async function activeUser(tx: DbExecutor, userId: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId}::uuid FOR UPDATE`;
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== 'ACTIVE' || user.staffStatus !== 'ACTIVE' || !user.emailVerifiedAt) {
    throw AppError.forbidden('Verify your email before managing workplaces');
  }
  return user;
}
export async function lockWorkplaceOwner(tx: DbExecutor, ctx: AgencyContext) {
  const member = await lockAgencyAccess(tx, ctx, P.TEAM_MANAGE);
  if (member.role !== 'OWNER' || !effectiveAgencyPermissions(member).includes(P.PERMISSIONS_MANAGE)) {
    throw AppError.forbidden('Only an active OWNER can manage workplace onboarding');
  }
  await activeUser(tx, member.userId);
  return member;
}

export class WorkplacesService {
  async create(userId: string, input: AgencyApplicationInput & { requestId: string }) {
    return prisma.$transaction(async tx => {
      const user = await activeUser(tx, userId); // also serializes retries for this user
      const previous = await tx.agencyCreationKey.findUnique({ where: { userId_key: { userId, key: input.requestId } }, include: { agency: true } });
      if (previous) {
        const owner = await tx.agencyMember.findFirst({ where: { agencyId: previous.agencyId, userId, role: 'OWNER', status: 'ACTIVE' } });
        if (!owner) throw AppError.forbidden('Workplace ownership has changed');
        return previous.agency;
      }
      const { requestId, ...profile } = input;
      const agency = await tx.agencyProfile.create({ data: { ...profile, userId: null } });
      // The migration trigger seeds roles before this lookup, including independent agencies.
      const role = await tx.agencyRole.findFirstOrThrow({ where: { agencyId: agency.id, systemRole: 'OWNER' } });
      await tx.agencyMember.create({ data: { agencyId: agency.id, userId, role: 'OWNER', roleId: role.id } });
      await tx.agencyCreationKey.create({ data: { userId, key: requestId, agencyId: agency.id } });
      await writeAudit(tx, { actorId: userId, actorRole: user.role, action: 'agency.created', targetType: 'agency', targetId: agency.id });
      return agency;
    });
  }

  async application(ctx: AgencyContext) {
    return prisma.$transaction(async tx => {
      await lockWorkplaceOwner(tx, ctx);
      return tx.agencyProfile.findUniqueOrThrow({ where: { id: ctx.agencyId } });
    });
  }

  async saveApplication(ctx: AgencyContext, input: AgencyApplicationInput, submit = false) {
    return prisma.$transaction(async tx => {
      const actor = await lockWorkplaceOwner(tx, ctx);
      const before = await tx.agencyProfile.findUniqueOrThrow({ where: { id: ctx.agencyId } });
      if (before.verificationStatus === 'PENDING') throw AppError.conflict('Application is already under review');
      const patch = { ...input,
        ...(input.address !== undefined ? { address: input.address.trim() || null } : {}),
        ...(input.licenseNumber !== undefined ? { licenseNumber: input.licenseNumber.trim() || null } : {}),
        ...(input.taxId !== undefined ? { taxId: input.taxId.trim() || null } : {}),
        ...(input.businessLicenseUrl !== undefined ? { businessLicenseUrl: input.businessLicenseUrl.trim() || null } : {}),
        ...(input.website !== undefined ? { website: input.website.trim() || null } : {}),
        ...(input.description !== undefined ? { description: input.description.trim() || null } : {}),
      };
      const profile = { ...before, ...patch };
      if (submit && (!profile.companyName?.trim() || !profile.licenseNumber?.trim() || !profile.address?.trim())) {
        throw AppError.badRequest('Company name, license number and address are required');
      }
      const legalChanged = ['companyName', 'licenseNumber', 'taxId', 'businessLicenseUrl'].some(key =>
        key in patch && patch[key as keyof typeof patch] !== before[key as keyof typeof before]);
      const status = submit ? 'PENDING' : before.verificationStatus === 'VERIFIED' && legalChanged ? 'UNVERIFIED' : before.verificationStatus;
      const result = await tx.agencyProfile.update({ where: { id: ctx.agencyId }, data: {
        ...patch, verificationStatus: status,
        ...(submit ? { submittedAt: new Date(), submissionDateEstimated: false, verificationNote: null } : {}),
        ...(status !== 'VERIFIED' ? { verifiedAt: null, verifiedById: null } : {}),
      } });
      if (status !== before.verificationStatus) await bumpAgencyPermissions(tx, ctx.agencyId);
      await writeAudit(tx, { actorId: actor.userId, actorRole: actor.user.role, action: 'agency.application_saved', targetType: 'agency', targetId: ctx.agencyId,
        metadata: { submitted: submit, status } });
      return result;
    });
  }

  async currentCode(ctx: AgencyContext) {
    return prisma.$transaction(async tx => {
      await lockWorkplaceOwner(tx, ctx);
      return tx.agencyJoinCode.findFirst({ where: { agencyId: ctx.agencyId, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, expiresAt: true } });
    });
  }
  async rotateCode(ctx: AgencyContext) {
    return prisma.$transaction(async tx => {
      const actor = await lockWorkplaceOwner(tx, ctx);
      await tx.agencyJoinCode.updateMany({ where: { agencyId: ctx.agencyId, revokedAt: null }, data: { revokedAt: new Date() } });
      const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
      // Keep sampling uniform even if the readable alphabet changes later.
      const sampleLimit = 256 - (256 % alphabet.length);
      let code = '';
      while (code.length < 12) for (const n of randomBytes(24)) { if (n < sampleLimit && code.length < 12) code += alphabet[n % alphabet.length]; }
      const row = await tx.agencyJoinCode.create({ data: { agencyId: ctx.agencyId, createdByUserId: actor.userId, codeHash: hash(code), expiresAt: new Date(Date.now() + JOIN_CODE_TTL_MS) } });
      await writeAudit(tx, { actorId: actor.userId, actorRole: actor.user.role, action: 'agency.join_code_changed', targetType: 'agency-join-code', targetId: row.id, metadata: { agencyId: ctx.agencyId, revoked: false } });
      return { id: row.id, code, expiresAt: row.expiresAt };
    });
  }
  async revokeCode(ctx: AgencyContext, id: string) {
    return prisma.$transaction(async tx => {
      const actor = await lockWorkplaceOwner(tx, ctx);
      const result = await tx.agencyJoinCode.updateMany({ where: { id, agencyId: ctx.agencyId, revokedAt: null }, data: { revokedAt: new Date() } });
      if (!result.count) throw AppError.notFound('Current code not found');
      await writeAudit(tx, { actorId: actor.userId, actorRole: actor.user.role, action: 'agency.join_code_changed', targetType: 'agency-join-code', targetId: id, metadata: { agencyId: ctx.agencyId, revoked: true } });
      return { revoked: true };
    });
  }

  async request(userId: string, code: string) {
    return prisma.$transaction(async tx => {
      const hint = await tx.agencyJoinCode.findUnique({ where: { codeHash: hash(code) } });
      if (!hint) throw AppError.badRequest('Join code is invalid or expired');
      await tx.$queryRaw`SELECT id FROM "AgencyProfile" WHERE id=${hint.agencyId}::uuid FOR UPDATE`;
      const user = await activeUser(tx, userId);
      const live = await tx.agencyJoinCode.findUnique({ where: { id: hint.id } });
      const issuer = await tx.agencyMember.findFirst({ where: { agencyId: hint.agencyId, userId: hint.createdByUserId, role: 'OWNER', status: 'ACTIVE', user: { status: 'ACTIVE', staffStatus: 'ACTIVE' } } });
      if (!live || live.revokedAt || live.expiresAt <= new Date() || !issuer) throw AppError.badRequest('Join code is invalid or expired');
      const existing = await tx.agencyMember.findUnique({ where: { agencyId_userId: { agencyId: hint.agencyId, userId } } });
      if (existing?.status === 'ACTIVE') throw AppError.conflict('Bạn đã là thành viên của doanh nghiệp này.');
      if (existing?.status === 'SUSPENDED') throw AppError.conflict('Bạn đang bị đình chỉ tại doanh nghiệp này. Hãy liên hệ người quản lý để được kích hoạt lại.');
      // Retire requests left behind by removals made before rejoining was supported.
      if (existing?.status === 'REMOVED') {
        await tx.agencyJoinRequest.updateMany({ where: { agencyId: hint.agencyId, userId, status: 'PENDING', createdAt: { lt: existing.updatedAt } }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
      }
      const pending = await tx.agencyJoinRequest.findFirst({ where: { agencyId: hint.agencyId, userId, status: 'PENDING' }, select: requestSelect });
      if (pending) return pending;
      // Bounded account-level submissions, including guesses spread over IP addresses.
      const recent = await tx.agencyJoinRequest.count({ where: { userId, createdAt: { gt: new Date(Date.now() - 3600000) } } });
      if (recent >= 10) throw AppError.tooManyRequests();
      const row = await tx.agencyJoinRequest.create({ data: { agencyId: hint.agencyId, userId, joinCodeId: hint.id, createdAt: new Date() }, select: requestSelect });
      await writeAudit(tx, { actorId: userId, actorRole: user.role, action: 'agency.join_request_changed', targetType: 'agency-join-request', targetId: row.id, metadata: { agencyId: row.agencyId, status: 'PENDING' } });
      const owners = await tx.agencyMember.findMany({ where: { agencyId: hint.agencyId, role: 'OWNER', status: 'ACTIVE', user: { status: 'ACTIVE', staffStatus: 'ACTIVE' } } });
      for (const owner of owners) await tx.notification.create({ data: { userId: owner.userId, agencyId: hint.agencyId, type: 'AGENCY_JOIN_REQUESTED', title: 'Yêu cầu tham gia doanh nghiệp', body: `${user.fullName} muốn tham gia doanh nghiệp.`, data: { requestId: row.id } } });
      return row;
    });
  }
  mine(userId: string, page: number) {
    return prisma.agencyJoinRequest.findMany({ where: { userId }, select: requestSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 20, skip: (page - 1) * 20 });
  }
  queue(ctx: AgencyContext, page: number) {
    return prisma.agencyJoinRequest.findMany({ where: { agencyId: ctx.agencyId, status: 'PENDING' }, select: { ...requestSelect, user: { select: { fullName: true, email: true } } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 20, skip: (page - 1) * 20 });
  }
  async cancel(userId: string, id: string) {
    return prisma.$transaction(async tx => {
      const hint = await tx.agencyJoinRequest.findFirst({ where: { id, userId } });
      if (!hint) throw AppError.notFound('Request not found');
      await tx.$queryRaw`SELECT id FROM "AgencyProfile" WHERE id=${hint.agencyId}::uuid FOR UPDATE`;
      const user = await activeUser(tx, userId);
      const row = await tx.agencyJoinRequest.findUniqueOrThrow({ where: { id } });
      if (row.status === 'CANCELLED') return { cancelled: true };
      if (row.status !== 'PENDING') throw AppError.conflict('Request is no longer pending');
      await tx.agencyJoinRequest.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
      await writeAudit(tx, { actorId: userId, actorRole: user.role, action: 'agency.join_request_changed', targetType: 'agency-join-request', targetId: id, metadata: { agencyId: row.agencyId, status: 'CANCELLED' } });
      return { cancelled: true };
    });
  }
  async review(ctx: AgencyContext, id: string, roleId?: string) {
    return prisma.$transaction(async tx => {
      const actor = await lockWorkplaceOwner(tx, ctx);
      const row = await tx.agencyJoinRequest.findFirst({ where: { id, agencyId: ctx.agencyId } });
      if (!row) throw AppError.notFound('Request not found');
      const status = roleId ? 'APPROVED' : 'REJECTED';
      if (row.status === status && (!roleId || row.assignedRoleId === roleId)) return { status };
      if (row.status !== 'PENDING') throw AppError.conflict('Request is no longer pending');
      await activeUser(tx, row.userId);
      if (roleId) {
        const role = await tx.agencyRole.findFirst({ where: { id: roleId, agencyId: ctx.agencyId } });
        if (!role || role.systemRole === 'OWNER') throw AppError.badRequest('Choose a non-OWNER role in this agency');
        assertDelegable(actor, role.permissions);
        await joinOrRestoreAgencyMember(tx, ctx.agencyId, row.userId, role, actor, row.createdAt);
        await bumpAgencyPermissions(tx, ctx.agencyId);
      }
      await tx.agencyJoinRequest.update({ where: { id }, data: { status, assignedRoleId: roleId ?? null, reviewedAt: new Date(), reviewedByUserId: actor.userId } });
      await writeAudit(tx, { actorId: actor.userId, actorRole: actor.user.role, action: 'agency.join_request_changed', targetType: 'agency-join-request', targetId: id, metadata: { agencyId: ctx.agencyId, status } });
      await writeNotification(tx, row.userId, { type: 'AGENCY_JOIN_REVIEWED', title: roleId ? 'Yêu cầu tham gia đã được duyệt' : 'Yêu cầu tham gia đã bị từ chối', body: 'Mở Nơi làm việc để xem trạng thái doanh nghiệp.', data: { agencyId: ctx.agencyId } });
      return { status };
    });
  }
}
export const workplacesService = new WorkplacesService();
