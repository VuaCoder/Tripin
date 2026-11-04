import type { AgencyVerificationStatus, PersistedRole, UserStatus } from '@travel-platform/constants';
import { nullIfNotFound, prisma, type Prisma } from '../../config/database';
import type { AgencyProfile, GuideProfile, User } from '../../generated/prisma/client';
import { toSkip, type PageRequest } from '../../utils/pagination';
import { containsText } from '../../utils/search';

export interface UserListFilter {
  from?: Date;
  to?: Date;
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
export type PublicGuideRecord = Pick<User, 'id' | 'fullName' | 'avatarUrl'> & {
  guideProfile: Pick<GuideProfile, 'bio' | 'languages' | 'specialties' | 'experienceYears'> | null;
};

const include = { agencyProfile: true, guideProfile: true } satisfies Prisma.UserInclude;
const omitPassword = { passwordHash: true } as const;

function toData(patch: UserPatch): Prisma.UserUncheckedUpdateInput {
  const { agencyProfile, guideProfile, ...scalars } = patch;
  const data: Prisma.UserUncheckedUpdateInput = {
    ...scalars,
    ...(scalars.preferences !== undefined ? { preferences: (scalars.preferences ?? null) as any } : {}),
  } as Prisma.UserUncheckedUpdateInput;
  if (agencyProfile) data.agencyProfile = { upsert: { create: agencyProfile, update: agencyProfile } };
  if (guideProfile) data.guideProfile = { upsert: { create: guideProfile, update: guideProfile } };
  return data;
}

/** All database access of the users domain. Services never touch Prisma directly. */
export class UsersRepository {
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
      prisma.user.findMany({ where, include, omit: omitPassword, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: toSkip(page), take: page.limit }),
      prisma.user.count({ where }),
    ]);
    return { items, total };
  }
}

export const usersRepository = new UsersRepository();
