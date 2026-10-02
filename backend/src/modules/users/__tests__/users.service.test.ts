import { describe, expect, it, vi } from 'vitest';
import { AGENCY_VERIFICATION_STATUS, ROLES, USER_STATUS } from '@travel-platform/constants';
import { ERROR_CODES } from '../../../utils/app-error';
import { UsersService } from '../users.service';

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    email: 'a@b.com',
    fullName: 'A B',
    role: ROLES.TRAVELER,
    status: USER_STATUS.ACTIVE,
    twoFactorEnabled: false,
    extraPermissions: [],
    createdAt: new Date(),
    ...overrides,
  };
}

type FakeUser = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Applies a repository patch; nested role profiles are merged into the existing profile. */
function applyPatch(user: FakeUser, patch: Record<string, unknown> = {}) {
  for (const [key, value] of Object.entries(patch)) {
    if ((key === 'agencyProfile' || key === 'guideProfile') && value && typeof value === 'object') {
      user[key] = { ...(user[key] ?? {}), ...(value as object) };
    } else {
      user[key] = value;
    }
  }
}

function makeService(initial: Record<string, FakeUser>) {
  const db: Record<string, FakeUser> = { ...initial };
  const repo = {
    findById: vi.fn(async (id: string) => db[id] ?? null),
    findManyByIds: vi.fn(async (ids: string[]) => ids.map((id) => db[id]).filter(Boolean)),
    updateById: vi.fn(async (id: string, patch: Record<string, unknown>) => {
      const user = db[id];
      if (user) applyPatch(user, patch);
      return user ?? null;
    }),
    updateStatusIf: vi.fn(async (id: string, expected: string, patch: Record<string, unknown>) => {
      const user = db[id];
      if (!user || user.status !== expected) return null;
      applyPatch(user, patch);
      return user;
    }),
    updateAgencyVerificationIf: vi.fn(async (id: string, expected: string, patch: Record<string, unknown>) => {
      const user = db[id];
      if (!user || user.agencyProfile?.verificationStatus !== expected) return null;
      applyPatch(user, patch);
      return user;
    }),
    count: vi.fn(async () => 1),
    list: vi.fn(async () => ({ items: Object.values(db), total: Object.keys(db).length })),
  };
  const audit = { record: vi.fn(async () => undefined) };
  return { service: new UsersService(repo as never, audit), repo, db, audit };
}

const MOD = { userId: 'm1', role: ROLES.MODERATOR } as const;
const ADMIN = (userId: string) => ({ userId, role: ROLES.SUPER_ADMIN }) as const;

describe('UsersService profile', () => {
  it('rejects agency fields from a traveler', async () => {
    const { service } = makeService({ u1: makeUser() });
    await expect(service.updateMe('u1', { agencyProfile: { companyName: 'X Co' } })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('updates only allowed fields, nesting the role profile', async () => {
    const { service, repo } = makeService({ u1: makeUser({ role: ROLES.AGENCY }) });
    await service.updateMe('u1', { fullName: 'New Name', agencyProfile: { companyName: 'Sun Travel' } });
    expect(repo.updateById.mock.calls[0]![1]).toEqual({ fullName: 'New Name', agencyProfile: { companyName: 'Sun Travel' } });
  });

  it('never exposes email or phone in the public guide profile', async () => {
    const { service } = makeService({ g1: makeUser({ id: 'g1', role: ROLES.TOUR_GUIDE, phone: '+84 123456', guideProfile: { languages: ['vi'], specialties: [] } }) });
    const dto = await service.getPublicGuide('g1');
    expect(dto).not.toHaveProperty('email');
    expect(dto).not.toHaveProperty('phone');
    expect(dto.languages).toEqual(['vi']);
  });

  it('hides banned or wrong-role accounts from public profiles', async () => {
    const { service } = makeService({
      g1: makeUser({ id: 'g1', role: ROLES.TOUR_GUIDE, status: USER_STATUS.BANNED }),
      t1: makeUser({ id: 't1' }),
    });
    await expect(service.getPublicGuide('g1')).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.getPublicGuide('t1')).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.getPublicAgency('t1')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('UsersService agency verification', () => {
  const agency = (status: string, extra: Record<string, unknown> = {}) =>
    makeUser({
      id: 'a1',
      role: ROLES.AGENCY,
      agencyProfile: { companyName: 'Sun', licenseNumber: 'LIC-1', verificationStatus: status, ...extra },
    });

  it('requires company name and license before requesting', async () => {
    const { service } = makeService({
      a1: makeUser({ id: 'a1', role: ROLES.AGENCY, agencyProfile: { verificationStatus: AGENCY_VERIFICATION_STATUS.UNVERIFIED } }),
    });
    await expect(service.requestAgencyVerification('a1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('moves UNVERIFIED -> PENDING and refuses a second request', async () => {
    const { service } = makeService({ a1: agency(AGENCY_VERIFICATION_STATUS.UNVERIFIED) });
    await service.requestAgencyVerification('a1');
    await expect(service.requestAgencyVerification('a1')).rejects.toMatchObject({ code: ERROR_CODES.INVALID_STATE_TRANSITION });
  });

  it('lets a moderator approve only a PENDING request', async () => {
    const { service, db } = makeService({ a1: agency(AGENCY_VERIFICATION_STATUS.PENDING) });
    await service.decideAgencyVerification(MOD, 'a1', { approve: true });
    expect((db.a1!.agencyProfile as { verificationStatus: string }).verificationStatus).toBe(AGENCY_VERIFICATION_STATUS.VERIFIED);
    await expect(service.decideAgencyVerification(MOD, 'a1', { approve: false })).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_STATE_TRANSITION,
    });
  });
});

describe('UsersService access & bans', () => {
  it('forbids changing your own access', async () => {
    const { service } = makeService({ s1: makeUser({ id: 's1', role: ROLES.SUPER_ADMIN }) });
    await expect(service.assignAccess(ADMIN('s1'), 's1', { role: ROLES.TRAVELER })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('promotes a user to MODERATOR and drops unknown permissions', async () => {
    const { service, db, audit } = makeService({ u1: makeUser(), s1: makeUser({ id: 's1', role: ROLES.SUPER_ADMIN }) });
    await service.assignAccess(ADMIN('s1'), 'u1', { role: ROLES.MODERATOR, extraPermissions: ['audit:view', 'bogus:perm' as never] });
    expect(db.u1!.role).toBe(ROLES.MODERATOR);
    expect(db.u1!.extraPermissions).toEqual(['audit:view']);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'user.access_assigned', targetId: 'u1' }));
  });

  it('refuses to demote the last super admin', async () => {
    const { service } = makeService({
      s1: makeUser({ id: 's1', role: ROLES.SUPER_ADMIN }),
      s2: makeUser({ id: 's2', role: ROLES.SUPER_ADMIN }),
    });
    await expect(service.assignAccess(ADMIN('s1'), 's2', { role: ROLES.TRAVELER })).rejects.toMatchObject({ code: 'LAST_SUPER_ADMIN' });
  });

  it('lets a moderator ban a traveler but not another moderator or a super admin', async () => {
    const { service, db, audit } = makeService({
      u1: makeUser(),
      m2: makeUser({ id: 'm2', role: ROLES.MODERATOR }),
      s1: makeUser({ id: 's1', role: ROLES.SUPER_ADMIN }),
    });
    const moderator = { userId: 'm1', role: ROLES.MODERATOR } as const;
    await service.banUser(moderator, 'u1', 'spam');
    expect(db.u1!.status).toBe(USER_STATUS.BANNED);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'user.banned', metadata: { reason: 'spam' } }));
    await expect(service.banUser(moderator, 'm2', 'x')).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.banUser(moderator, 's1', 'x')).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.banUser(moderator, 'u1', 'again')).rejects.toMatchObject({ code: ERROR_CODES.INVALID_STATE_TRANSITION });
  });

  it('cannot ban yourself, and unban only works on banned accounts', async () => {
    const { service } = makeService({ u1: makeUser() });
    await expect(service.banUser({ userId: 'u1', role: ROLES.MODERATOR }, 'u1', 'x')).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.unbanUser(MOD, 'u1')).rejects.toMatchObject({ code: ERROR_CODES.INVALID_STATE_TRANSITION });
  });
});
