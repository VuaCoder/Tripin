import { prisma } from '../../config/database';
import type { AgencyProfile } from '../../generated/prisma/client';
import type { AgencyVerificationStatus, PersistedRole } from '@travel-platform/constants';
import { AppError } from '../../utils/app-error';
import { buildPage } from '../../utils/pagination';
import { assertTransition } from '../../utils/state-machine';
import { AGENCY_VERIFICATION_TRANSITIONS, type PrivateUserDto } from '../users/users.types';
import { writeAudit } from '../audit/audit.writer';
import { permissionsOf } from '../users/users.mapper';

// Keep the existing moderation screen's profile envelope; its id is explicitly an agency id.
export type AgencyModerationDto = Pick<PrivateUserDto, 'id' | 'fullName' | 'email' | 'phone' | 'createdAt' | 'agencyProfile'>;
const include = { members: { where: { role: 'OWNER' as const, status: 'ACTIVE' as const, user: { status: 'ACTIVE' as const, staffStatus: 'ACTIVE' } }, orderBy: { createdAt: 'asc' as const }, take: 1,
  select: { user: { select: { fullName: true, email: true, phone: true } } } } } as const;
function dto(profile: AgencyProfile & { members: { user: { fullName: string; email: string; phone: string | null } }[] }): AgencyModerationDto {
  const owner = profile.members[0]?.user;
  return { id: profile.id, fullName: owner?.fullName ?? profile.companyName ?? 'Agency', email: owner?.email ?? '', phone: owner?.phone ?? undefined,
    createdAt: (profile.submittedAt ?? new Date(0)).toISOString(), agencyProfile: {
      companyName: profile.companyName ?? undefined, description: profile.description ?? undefined,
      address: profile.address ?? undefined, website: profile.website ?? undefined,
      licenseNumber: profile.licenseNumber ?? undefined, taxId: profile.taxId ?? undefined,
      businessLicenseUrl: profile.businessLicenseUrl ?? undefined, submittedAt: profile.submittedAt?.toISOString(),
      submissionDateEstimated: profile.submissionDateEstimated, verificationStatus: profile.verificationStatus,
      verificationNote: profile.verificationNote ?? undefined,
    } };
}
export const agencyProfileRepository = {
  async publicProfile(id: string) {
    const profile = await prisma.agencyProfile.findFirst({ where: { id, members: { some: { role: 'OWNER', status: 'ACTIVE', user: { status: 'ACTIVE', staffStatus: 'ACTIVE' } } } } });
    if (!profile) throw AppError.notFound('Agency not found');
    return { id: profile.id, fullName: profile.companyName ?? 'Agency', companyName: profile.companyName ?? undefined,
      description: profile.description ?? undefined, address: profile.address ?? undefined, website: profile.website ?? undefined,
      verified: profile.verificationStatus === 'VERIFIED' };
  },
  async list(status: AgencyVerificationStatus, page: { page: number; limit: number }) {
    const where = { verificationStatus: status };
    const [rows, total] = await Promise.all([
      prisma.agencyProfile.findMany({ where, include, orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }], take: page.limit, skip: (page.page - 1) * page.limit }),
      prisma.agencyProfile.count({ where }),
    ]);
    return buildPage(rows.map(dto), total, page);
  },
  async decide(actor: { userId: string; role: PersistedRole }, id: string, decision: { approve: boolean; note?: string; requestInformation?: boolean }) {
    return prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "AgencyProfile" WHERE id=${id}::uuid FOR UPDATE`;
      const moderator = await tx.user.findUnique({ where: { id: actor.userId } });
      if (!moderator || moderator.status !== 'ACTIVE' || moderator.staffStatus !== 'ACTIVE' || !permissionsOf(moderator).includes('agency:verify')) throw AppError.forbidden();
      const before = await tx.agencyProfile.findUnique({ where: { id } });
      if (!before) throw AppError.notFound('Agency not found');
      const status = decision.requestInformation ? 'INFORMATION_REQUESTED' : decision.approve ? 'VERIFIED' : 'REJECTED';
      assertTransition(AGENCY_VERIFICATION_TRANSITIONS, before.verificationStatus, status, 'Agency verification');
      const row = await tx.agencyProfile.update({ where: { id }, data: { verificationStatus: status, verifiedById: status === 'VERIFIED' ? actor.userId : null,
        verifiedAt: status === 'VERIFIED' ? new Date() : null, verificationNote: decision.note ?? null, permissionVersion: { increment: 1 } }, include });
      await writeAudit(tx, { actorId: actor.userId, actorRole: actor.role, action: 'agency.verification_decided', targetType: 'agency', targetId: id,
        metadata: { before: { status: before.verificationStatus }, after: { status }, approved: decision.approve, note: decision.note } });
      return dto(row);
    });
  },
};
