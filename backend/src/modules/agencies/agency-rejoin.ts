import type { AgencyRole } from '../../generated/prisma/client';
import type { DbExecutor } from '../../config/database';
import { AppError } from '../../utils/app-error';
import { primaryAgencyOwnerId } from './agency-ownership';

type JoinActor = { userId: string; role: string; agency: { userId: string | null; creationKey: { userId: string } | null } };

/** Caller must hold the agency lock and validate the invitation/approval and actor's grants. */
export async function joinOrRestoreAgencyMember(tx: DbExecutor, agencyId: string, userId: string,
  role: Pick<AgencyRole, 'id' | 'systemRole'>, actor: JoinActor, requestedAt: Date) {
  const previous = await tx.agencyMember.findUnique({ where: { agencyId_userId: { agencyId, userId } } });
  if (!previous) return tx.agencyMember.create({ data: { agencyId, userId, role: role.systemRole ?? 'STAFF', roleId: role.id } });
  // A concurrent, legitimate admission must not have its role overwritten.
  if (previous.status === 'ACTIVE') return previous;
  if (previous.status === 'SUSPENDED') throw AppError.conflict('Bạn đang bị đình chỉ tại doanh nghiệp này. Hãy liên hệ người quản lý để được kích hoạt lại.');
  if (requestedAt < previous.updatedAt) throw AppError.conflict('Lời mời hoặc yêu cầu này có trước khi bạn bị gỡ. Hãy nhận lời mời mới hoặc gửi lại yêu cầu tham gia.');
  const primaryOwnerId = primaryAgencyOwnerId(actor.agency);
  if (userId === primaryOwnerId || (previous.role === 'OWNER' && (actor.role !== 'OWNER' || actor.userId !== primaryOwnerId))) {
    throw AppError.forbidden('Chỉ Owner được tiếp nhận lại Co_Owner đã bị gỡ.');
  }
  await tx.agencyMemberPermissionOverride.deleteMany({ where: { agencyId, memberId: previous.id } });
  await tx.agencyMemberTourScope.deleteMany({ where: { agencyId, memberId: previous.id } });
  return tx.agencyMember.update({ where: { id: previous.id }, data: { role: role.systemRole ?? 'STAFF', roleId: role.id, status: 'ACTIVE', updatedAt: new Date() } });
}
