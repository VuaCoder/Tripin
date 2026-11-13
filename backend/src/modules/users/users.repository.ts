import type { AuditEntry } from '../audit/audit.types';
import type { AgencyVerificationStatus, PersistedRole, UserStatus } from '@travel-platform/constants';
import { nullIfNotFound, prisma, type Prisma } from '../../config/database';
import type { AgencyProfile, GuideProfile, GuidePayoutAccount, User } from '../../generated/prisma/client';
import { toSkip, type PageRequest } from '../../utils/pagination';
import { containsText } from '../../utils/search';
import { AppError } from '../../utils/app-error';
import { enqueueMail } from '../notifications/mail-outbox';
import { formatBanEmail, formatUnbanEmail } from '../notifications/email-templates';
import { writeAudit } from '../audit/audit.writer';
import { AUDIT_ACTIONS } from '../audit/audit.types';

export interface UserListFilter {
  from?: Date;
  to?: Date;
  role?: PersistedRole;
  status?: UserStatus;
  q?: string;
  agencyVerification?: AgencyVerificationStatus;
}

export type AgencyProfileFields = Partial<Omit<AgencyProfile, 'id' | 'userId'>>;
export type GuideProfileFields = Partial<Omit<GuideProfile, 'userId'>>;

/** A stored user with its role profiles. `passwordHash` is only present on the `...WithPassword` lookups. */
export type UserRecord = Omit<User, 'passwordHash'> & {
  passwordHash?: string | null;
  agencyProfile: AgencyProfile | null;
  guideProfile: GuideProfile | null;
  payoutAccount?: GuidePayoutAccount | null;
};

/** Plain-field changes; `agencyProfile`/`guideProfile` are created on first write and merged afterwards. */
export type UserPatch = Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>> & {
  agencyProfile?: AgencyProfileFields;
  guideProfile?: GuideProfileFields;
  payoutAccount?: Pick<GuidePayoutAccount, 'encryptedDetails' | 'keyVersion' | 'last4'> | null;
};
export type NewUser = Pick<User, 'email' | 'fullName'> & UserPatch;
export type PublicGuideRecord = Pick<User, 'id' | 'fullName' | 'avatarUrl'> & {
  guideProfile: Pick<GuideProfile, 'bio' | 'languages' | 'specialties' | 'experienceYears'> | null;
};

const include = { agencyProfile: true, guideProfile: true, payoutAccount: true } satisfies Prisma.UserInclude;
const omitPassword = { passwordHash: true } as const;

function toData(patch: UserPatch): Prisma.UserUncheckedUpdateInput {
  const { agencyProfile, guideProfile, payoutAccount, ...scalars } = patch;
  const data: Prisma.UserUncheckedUpdateInput = {
    ...scalars,
    ...(scalars.preferences !== undefined ? { preferences: (scalars.preferences ?? null) as any } : {}),
  } as Prisma.UserUncheckedUpdateInput;
  if (agencyProfile) data.agencyProfile = { upsert: { create: agencyProfile, update: agencyProfile } };
  if (guideProfile) data.guideProfile = { upsert: { create: guideProfile, update: guideProfile } };
  if (payoutAccount) data.payoutAccount = { upsert: { create: payoutAccount, update: payoutAccount } };
  if (payoutAccount === null) data.payoutAccount = { delete: true };
  return data;
}

/** All database access of the users domain. Services never touch Prisma directly. */
export class UsersRepository {
  async deleteAdminUser(actor: { userId: string; role: PersistedRole }, targetId: string): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        const acting = await tx.user.findUnique({ where: { id: actor.userId }, select: { role: true, status: true, staffStatus: true } });
        if (!acting || acting.role !== 'SUPER_ADMIN' || acting.status !== 'ACTIVE' || acting.staffStatus !== 'ACTIVE') throw AppError.forbidden();
        const target = await tx.user.findUnique({ where: { id: targetId }, select: { id: true, role: true, status: true } });
        if (!target) throw AppError.notFound('User not found');
        if (actor.userId === targetId) throw AppError.forbidden('You cannot delete your own account');
        if (target.role === 'MODERATOR' || target.role === 'SUPER_ADMIN') throw AppError.badRequest('Staff accounts cannot be deleted; disable or change their role first');
        await writeAudit(tx, { actorId: actor.userId, actorRole: actor.role, action: AUDIT_ACTIONS.USER_DELETED, targetType: 'user', targetId,
          metadata: { role: target.role, status: target.status } });
        await tx.user.delete({ where: { id: targetId } });
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && ['P2003', 'P2014'].includes(String(error.code))) {
        throw AppError.conflict('Tài khoản có dữ liệu nghiệp vụ cần lưu nên không thể xóa an toàn. Hãy khóa tài khoản thay thế.');
      }
      throw error;
    }
  }

  /** A shared transaction lock serializes all staff access/lifecycle mutations. */
  async changeAccess(actor: { userId: string; role: PersistedRole }, targetId: string, patch: UserPatch, reason?: string): Promise<UserRecord> {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(54821)`;
      const acting = await tx.user.findUnique({ where: { id: actor.userId } });
      if (!acting || acting.role !== 'SUPER_ADMIN' || acting.status !== 'ACTIVE' || acting.staffStatus !== 'ACTIVE') throw AppError.forbidden();
      const before = await tx.user.findUnique({ where: { id: targetId } });
      if (!before) throw AppError.notFound('User not found');
      if (actor.userId === targetId) throw AppError.forbidden('You cannot change your own access');
      if ((patch.role && ['MODERATOR', 'SUPER_ADMIN'].includes(patch.role) || patch.extraPermissions?.some((p) => /^(tour:(validate|suspend|list-all)|agency:verify|dispute:resolve|complaint:handle|account:ban|review:moderate|moderation:dashboard)$/.test(p))) && !before.emailVerifiedAt) throw AppError.badRequest('Verify email before granting staff privileges');
      if (before.role === 'SUPER_ADMIN' && (patch.role && patch.role !== 'SUPER_ADMIN' || patch.staffStatus === 'DISABLED')) {
        const count = await tx.user.count({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE', staffStatus: 'ACTIVE' } });
        if (count <= 1) throw AppError.conflict('Cannot demote the last active Super Admin', 'LAST_SUPER_ADMIN');
      }
      const after = await tx.user.update({ where: { id: targetId }, data: { ...toData(patch), ...(patch.staffStatus === 'DISABLED' ? { tokenVersion: { increment: 1 } } : {}) }, include, omit: omitPassword });
      if (patch.staffStatus === 'DISABLED') await tx.refreshToken.updateMany({ where: { userId: targetId, revokedAt: null }, data: { revokedAt: new Date() } });
      await writeAudit(tx, { actorId: actor.userId, actorRole: actor.role, action: AUDIT_ACTIONS.USER_ACCESS_ASSIGNED, targetType: 'user', targetId,
        metadata: { reason, before: { role: before.role, extraPermissions: before.extraPermissions, revokedPermissions: before.revokedPermissions, staffStatus: before.staffStatus }, after: { role: after.role, extraPermissions: after.extraPermissions, revokedPermissions: after.revokedPermissions, staffStatus: after.staffStatus } } });
      return after;
    });
  }

  async changeBan(actor: { userId: string; role: PersistedRole }, targetId: string, ban: boolean, reason: string): Promise<UserRecord> {
    return prisma.$transaction(async (tx) => {
      const before = await tx.user.findUnique({ where: { id: targetId } });
      if (!before) throw AppError.notFound('User not found');
      if (['MODERATOR', 'SUPER_ADMIN'].includes(before.role)) throw AppError.badRequest('Use the staff disable action for staff accounts');
      const expected = ban ? 'ACTIVE' : 'BANNED';
      if (before.status !== expected) throw AppError.conflict('Account status changed', 'CONCURRENT_UPDATE');
      const after = await tx.user.update({ where: { id: targetId, status: expected }, data: {
        status: ban ? 'BANNED' : 'ACTIVE', tokenVersion: { increment: 1 }, bannedAt: ban ? new Date() : null,
        bannedById: ban ? actor.userId : null, banReason: ban ? reason : null,
      }, include, omit: omitPassword });
      await tx.refreshToken.updateMany({ where: { userId: targetId, revokedAt: null }, data: { revokedAt: new Date() } });
      await writeAudit(tx, { actorId: actor.userId, actorRole: actor.role, action: ban ? AUDIT_ACTIONS.USER_BANNED : AUDIT_ACTIONS.USER_UNBANNED,
        targetType: 'user', targetId, metadata: { before: { status: before.status, banReason: before.banReason, bannedAt: before.bannedAt }, after: { status: after.status, banReason: after.banReason, bannedAt: after.bannedAt }, reason } });
      if (ban) {
        await enqueueMail(
          tx,
          `ban:${targetId}:${after.tokenVersion}`,
          before.email,
          '[TripRI] Thông báo tạm khóa tài khoản người dùng',
          formatBanEmail({ fullName: before.fullName, email: before.email, reason }),
        );
      } else {
        await enqueueMail(
          tx,
          `unban:${targetId}:${after.tokenVersion}`,
          before.email,
          '[TripRI] Tài khoản của bạn đã được mở khóa thành công',
          formatUnbanEmail({ fullName: before.fullName, email: before.email, reason }),
        );
      }
      return after;
    });
  }

  async listActiveGuides(q: string | undefined, page: PageRequest): Promise<{ items: PublicGuideRecord[]; total: number }> {
    const where: Prisma.UserWhereInput = { role: 'TOUR_GUIDE', status: 'ACTIVE', ...(q ? { fullName: containsText(q) } : {}) };
    const [items, total] = await Promise.all([
      (async () => {
        const now = new Date();
        // Apply membership ranking in SQL before LIMIT/OFFSET; escape wildcard input for literal search.
        const pattern = '%' + (q ?? '').replace(/[\\%_]/g, '\\$&') + '%';
        const ids = await prisma.$queryRaw<{ id: string; premiumActive: boolean }[]>`SELECT u.id, EXISTS (SELECT 1 FROM "Subscription" s WHERE s."userId" = u.id AND s."isPremium" = true AND s.audience = 'TOUR_GUIDE' AND s.status = 'ACTIVE' AND s."revokedAt" IS NULL AND s."startsAt" <= ${now} AND s."endsAt" > ${now}) AS "premiumActive" FROM "User" u WHERE u.role = 'TOUR_GUIDE' AND u.status = 'ACTIVE' AND u."fullName" ILIKE ${pattern} ORDER BY "premiumActive" DESC, u."fullName" ASC, u.id ASC OFFSET ${toSkip(page)} LIMIT ${page.limit}`;
        const users = await prisma.user.findMany({ where: { id: { in: ids.map(x => x.id) } }, select: { id: true, fullName: true, avatarUrl: true, guideProfile: { select: { bio: true, languages: true, specialties: true, experienceYears: true } } } });
        return ids.map(row => ({ ...users.find(user => user.id === row.id)!, premiumActive: row.premiumActive }));
      })(),
      prisma.user.count({ where }),
    ]);
    return { items, total };
  }

  findById(id: string): Promise<UserRecord | null> {
    return prisma.user.findUnique({ where: { id }, include, omit: omitPassword });
  }

  findByEmail(email: string): Promise<UserRecord | null> {
    return prisma.user.findUnique({ where: { email: email.toLowerCase() }, include, omit: omitPassword });
  }

  /** Includes the `passwordHash` field that is hidden by default. */
  findByEmailWithPassword(email: string): Promise<UserRecord | null> {
    return prisma.user.findUnique({ where: { email: email.toLowerCase() }, include });
  }

  findByIdWithPassword(id: string): Promise<UserRecord | null> {
    return prisma.user.findUnique({ where: { id }, include });
  }

  findByGoogleId(googleId: string): Promise<UserRecord | null> {
    return prisma.user.findUnique({ where: { googleId }, include, omit: omitPassword });
  }

  findManyByIds(ids: string[]): Promise<UserRecord[]> {
    return prisma.user.findMany({ where: { id: { in: ids } }, include, omit: omitPassword });
  }

  findAgencySummaries(ids: string[]) {
    return prisma.agencyProfile.findMany({ where: { id: { in: ids } }, select: { id: true, companyName: true } });
  }

  create(data: NewUser): Promise<UserRecord> {
    const { agencyProfile, guideProfile, ...scalars } = data;
    return prisma.user.create({
      data: {
        ...scalars,
        email: data.email.toLowerCase(),
        ...(agencyProfile ? { agencyProfile: { create: agencyProfile } } : {}),
        ...(guideProfile ? { guideProfile: { create: guideProfile } } : {}),
      } as any,
      include,
      omit: omitPassword,
    }) as unknown as Promise<UserRecord>;
  }

  updateById(id: string, patch: UserPatch): Promise<UserRecord | null> {
    if (patch.preferences && typeof patch.preferences === 'object' && !Array.isArray(patch.preferences) && 'bankAccount' in patch.preferences) {
      return prisma.$transaction(async (tx) => {
        // A preferences request started before backfill must not reintroduce plaintext after migration.
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${id}::uuid FOR UPDATE`;
        const migrated = await tx.guidePayoutAccount.findUnique({ where: { guideId: id }, select: { guideId: true } });
        let safePatch = patch;
        if (migrated) {
          const { bankAccount: _legacy, ...preferences } = patch.preferences as Record<string, Prisma.JsonValue>;
          safePatch = { ...patch, preferences };
        }
        return tx.user.update({ where: { id }, data: toData(safePatch), include, omit: omitPassword });
      }).catch(nullIfNotFound);
    }
    return prisma.user.update({ where: { id }, data: toData(patch), include, omit: omitPassword }).catch(nullIfNotFound);
  }

  /** Bumps JWT generation so previously issued access tokens fail authentication. */
  incrementTokenVersion(id: string): Promise<UserRecord | null> {
    return prisma.user
      .update({ where: { id }, data: { tokenVersion: { increment: 1 } }, include, omit: omitPassword })
      .catch(nullIfNotFound);
  }

  /** Atomic status change guarded by the expected current status (prevents lost updates / double ban). */
  updateStatusIf(id: string, expected: UserStatus, patch: UserPatch): Promise<UserRecord | null> {
    return prisma.user.update({ where: { id, status: expected }, data: toData(patch), include, omit: omitPassword }).catch(nullIfNotFound);
  }

  /**
   * Compare-and-set on the agency verification status: null when another request already moved it (double decision).
   * The guard is an UPDATE of the `AgencyProfile` row itself (`WHERE verificationStatus = expected`). A guard written
   * on the user (`where: { agencyProfile: ... }`) would only be an `EXISTS` check on a snapshot, and two parallel
   * decisions would both pass it.
   */
  updateAgencyVerificationIf(id: string, expected: string, patch: UserPatch, audit?: AuditEntry): Promise<UserRecord | null> {
    const { agencyProfile, ...rest } = patch;
    return prisma.$transaction(async (tx) => {
      const guard = await tx.agencyProfile.updateMany({
        where: { userId: id, verificationStatus: expected as AgencyVerificationStatus },
        data: agencyProfile ?? {},
      });
      if (guard.count !== 1) return null;
      const { guideProfile, ...scalars } = rest;
      if (Object.keys(scalars).length > 0 || guideProfile) await tx.user.update({ where: { id }, data: toData({ ...scalars, guideProfile }) });
      if (audit) await writeAudit(tx, audit);
      return tx.user.findUnique({ where: { id }, include, omit: omitPassword });
    });
  }

  count(filter: { role?: PersistedRole; status?: UserStatus } = {}): Promise<number> {
    return prisma.user.count({ where: filter });
  }

  /** Accounts grouped by one field (`role` or `status`) for dashboards. */
  async countGroupedBy(field: 'role' | 'status'): Promise<Record<string, number>> {
    const rows = await prisma.user.groupBy({ by: [field], _count: { _all: true } });
    return Object.fromEntries(rows.map((row) => [row[field], row._count._all]));
  }

  countCreatedSince(since: Date): Promise<number> {
    return prisma.user.count({ where: { createdAt: { gte: since } } });
  }

  countAgenciesByVerification(status: AgencyVerificationStatus): Promise<number> {
    return prisma.agencyProfile.count({ where: { verificationStatus: status } });
  }

  async list(filter: UserListFilter, page: PageRequest): Promise<{ items: UserRecord[]; total: number }> {
    const where: Prisma.UserWhereInput = {};
    if (filter.from && filter.to) where.createdAt = { gte: filter.from, lte: filter.to };
    if (filter.role) where.role = filter.role;
    if (filter.status) where.status = filter.status;
    if (filter.agencyVerification) where.agencyProfile = { is: { verificationStatus: filter.agencyVerification } };
    if (filter.q) {
      where.OR = [
        { email: containsText(filter.q) },
        { fullName: containsText(filter.q) },
      ];
    }
    const [items, total] = await Promise.all([
      prisma.user.findMany({ where, include, omit: omitPassword, orderBy: filter.agencyVerification ? [{ agencyProfile: { submittedAt: 'asc' } }, { id: 'asc' }] : [{ createdAt: 'desc' }, { id: 'desc' }], skip: toSkip(page), take: page.limit }),
      prisma.user.count({ where }),
    ]);
    return { items, total };
  }
}

export const usersRepository = new UsersRepository();
