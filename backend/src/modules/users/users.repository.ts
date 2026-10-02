import type { AgencyVerificationStatus, PersistedRole, UserStatus } from '@travel-platform/constants';
import { nullIfNotFound, prisma, type Prisma } from '../../config/database';
import type { AgencyProfile, GuideProfile, User } from '../../generated/prisma/client';
import { toSkip, type PageRequest } from '../../utils/pagination';
import { containsText } from '../../utils/search';

export interface UserListFilter {
  role?: PersistedRole;
  status?: UserStatus;
  q?: string;
  agencyVerification?: AgencyVerificationStatus;
}

export type AgencyProfileFields = Partial<Omit<AgencyProfile, 'userId'>>;
export type GuideProfileFields = Partial<Omit<GuideProfile, 'userId'>>;

/** A stored user with its role profiles. `passwordHash` is only present on the `...WithPassword` lookups. */
export type UserRecord = Omit<User, 'passwordHash'> & {
  passwordHash?: string | null;
  agencyProfile: AgencyProfile | null;
  guideProfile: GuideProfile | null;
};

/** Plain-field changes; `agencyProfile`/`guideProfile` are created on first write and merged afterwards. */
export type UserPatch = Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>> & {
  agencyProfile?: AgencyProfileFields;
  guideProfile?: GuideProfileFields;
};
export type NewUser = Pick<User, 'email' | 'fullName'> & UserPatch;

const include = { agencyProfile: true, guideProfile: true } satisfies Prisma.UserInclude;
const omitPassword = { passwordHash: true } as const;

function toData(patch: UserPatch): Prisma.UserUncheckedUpdateInput {
  const { agencyProfile, guideProfile, ...scalars } = patch;
  const data: Prisma.UserUncheckedUpdateInput = { ...scalars };
  if (agencyProfile) data.agencyProfile = { upsert: { create: agencyProfile, update: agencyProfile } };
  if (guideProfile) data.guideProfile = { upsert: { create: guideProfile, update: guideProfile } };
  return data;
}

/** All database access of the users domain. Services never touch Prisma directly. */
export class UsersRepository {
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

  create(data: NewUser): Promise<UserRecord> {
    const { agencyProfile, guideProfile, ...scalars } = data;
    return prisma.user.create({
      data: {
        ...scalars,
        email: data.email.toLowerCase(),
        ...(agencyProfile ? { agencyProfile: { create: agencyProfile } } : {}),
        ...(guideProfile ? { guideProfile: { create: guideProfile } } : {}),
      },
      include,
      omit: omitPassword,
    });
  }

  updateById(id: string, patch: UserPatch): Promise<UserRecord | null> {
    return prisma.user.update({ where: { id }, data: toData(patch), include, omit: omitPassword }).catch(nullIfNotFound);
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
  updateAgencyVerificationIf(id: string, expected: string, patch: UserPatch): Promise<UserRecord | null> {
    const { agencyProfile, ...rest } = patch;
    return prisma.$transaction(async (tx) => {
      const guard = await tx.agencyProfile.updateMany({
        where: { userId: id, verificationStatus: expected as AgencyVerificationStatus },
        data: agencyProfile ?? {},
      });
      if (guard.count !== 1) return null;
      const { guideProfile, ...scalars } = rest;
      if (Object.keys(scalars).length > 0 || guideProfile) await tx.user.update({ where: { id }, data: toData({ ...scalars, guideProfile }) });
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
    return prisma.user.count({ where: { role: 'AGENCY', agencyProfile: { is: { verificationStatus: status } } } });
  }

  async list(filter: UserListFilter, page: PageRequest): Promise<{ items: UserRecord[]; total: number }> {
    const where: Prisma.UserWhereInput = {};
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
      prisma.user.findMany({ where, include, omit: omitPassword, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: toSkip(page), take: page.limit }),
      prisma.user.count({ where }),
    ]);
    return { items, total };
  }
}

export const usersRepository = new UsersRepository();
