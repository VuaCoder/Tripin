import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OTP_PURPOSE, ROLES, USER_STATUS } from '@travel-platform/constants';
import { AppError, ERROR_CODES } from '../../../utils/app-error';
import { AuthService, type AuthDeps } from '../auth.service';

// Ephemeral test-only credential, shared by the fake user's hash and login inputs.
// No seeded account, real user or external service uses this value.
const fixturePassword = randomUUID();

interface FakeUser {
  tokenVersion: number; staffStatus: string;
  id: string;
  _id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  passwordHash?: string;
  twoFactorEnabled: boolean;
  extraPermissions: string[];
  emailVerifiedAt?: Date;
  createdAt: Date;
  googleId?: string;
}

function makeUser(overrides: Partial<FakeUser> = {}): FakeUser {
  return {
    tokenVersion: 0, staffStatus: 'ACTIVE',
    id: 'u1',
    _id: 'u1',
    email: 'a@b.com',
    fullName: 'A B',
    role: ROLES.TRAVELER,
    status: USER_STATUS.ACTIVE,
    passwordHash: bcrypt.hashSync(fixturePassword, 4),
    twoFactorEnabled: false,
    extraPermissions: [],
    createdAt: new Date(),
    ...overrides,
  };
}

function makeDeps(user: FakeUser | null) {
  const store = { user };
  const tokens: { tokenVersion?: number; hash: string; family: string; revokedAt?: Date; expiresAt: Date; userId: string; id: string }[] = [];

  const deps = {
    agencies: { listForUser: vi.fn(async () => store.user?.role === ROLES.AGENCY ? [{ agencyId: store.user.id, memberId: 'owner-member', memberRole: 'OWNER', companyName: 'Fixture', verificationStatus: 'VERIFIED', permissions: [] }] : []) },
    users: {
      findByEmail: vi.fn(async () => store.user),
      findByEmailWithPassword: vi.fn(async () => store.user),
      findByIdWithPassword: vi.fn(async () => store.user),
      findByGoogleId: vi.fn(async () => null),
      findById: vi.fn(async () => store.user),
      create: vi.fn(async (data: Partial<FakeUser>) => {
        store.user = makeUser({ ...data, id: 'new', _id: 'new' });
        return store.user;
      }),
      updateById: vi.fn(async (_id: string, update: Record<string, unknown>) => {
        if (store.user) Object.assign(store.user, update);
        return store.user;
      }),
      incrementTokenVersion: vi.fn(async () => {
        if (store.user) store.user.tokenVersion += 1;
        return store.user;
      }),
      updateStatusIf: vi.fn(async (_id: string, expected: string, update: Record<string, unknown>) => {
        if (!store.user || store.user.status !== expected) return null;
        Object.assign(store.user, update);
        return store.user;
      }),
    },
    refreshTokens: {
      create: vi.fn(async (data: { tokenHash: string; family: string; expiresAt: Date; userId: string }) => {
        tokens.push({ tokenVersion: 0, hash: data.tokenHash, family: data.family, expiresAt: data.expiresAt, userId: data.userId, id: `t${tokens.length}` });
      }),
      findByHash: vi.fn(async (hash: string) => tokens.find((t) => t.hash === hash) ?? null),
      revokeIfActive: vi.fn(async (id: string) => {
        const token = tokens.find((t) => t.id === id);
        if (!token || token.revokedAt) return null;
        token.revokedAt = new Date();
        return token;
      }),
      revokeFamily: vi.fn(async (family: string) => {
        tokens.filter((t) => t.family === family).forEach((t) => (t.revokedAt = new Date()));
      }),
      revokeAllForUser: vi.fn(async () => undefined),
    },
    otp: { issue: vi.fn(async () => ({ code: '123456', expiresInSeconds: 600 })), verify: vi.fn(async () => undefined) },
    mail: { send: vi.fn(async () => undefined) },
    google: { verifyIdToken: vi.fn() },
  };
  return { deps: deps as unknown as AuthDeps, mocks: deps, tokens, store };
}

describe('AuthService.login', () => {
  let ctx: ReturnType<typeof makeDeps>;
  beforeEach(() => {
    ctx = makeDeps(makeUser());
  });

  it('opens a session with valid credentials', async () => {
    const result = await new AuthService(ctx.deps).login({ email: 'a@b.com', password: fixturePassword });
    expect(result.twoFactorRequired).toBe(false);
    if (!result.twoFactorRequired) {
      expect(result.session.accessToken).toBeTruthy();
      expect(result.session.user.role).toBe(ROLES.TRAVELER);
    }
    expect(ctx.tokens).toHaveLength(1);
  });

  it('rejects a wrong password with the generic credentials error', async () => {
    await expect(new AuthService(ctx.deps).login({ email: 'a@b.com', password: randomUUID() })).rejects.toMatchObject({
      statusCode: 401,
      code: ERROR_CODES.INVALID_CREDENTIALS,
    });
  });

  it('rejects an unknown email with the same error', async () => {
    const empty = makeDeps(null);
    await expect(new AuthService(empty.deps).login({ email: 'x@y.com', password: fixturePassword })).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_CREDENTIALS,
    });
  });

  it('blocks banned accounts', async () => {
    ctx.store.user!.status = USER_STATUS.BANNED;
    await expect(new AuthService(ctx.deps).login({ email: 'a@b.com', password: fixturePassword })).rejects.toMatchObject({
      statusCode: 403,
      code: ERROR_CODES.ACCOUNT_BANNED,
    });
  });

  it('asks unverified accounts to verify and re-sends the code', async () => {
    ctx.store.user!.status = USER_STATUS.PENDING_VERIFICATION;
    await expect(new AuthService(ctx.deps).login({ email: 'a@b.com', password: fixturePassword })).rejects.toMatchObject({
      code: ERROR_CODES.ACCOUNT_NOT_VERIFIED,
    });
    expect(ctx.mocks.otp.issue).toHaveBeenCalledWith('u1', OTP_PURPOSE.REGISTER);
  });

  it('requires an OTP step when 2FA is enabled and issues no session yet', async () => {
    ctx.store.user!.twoFactorEnabled = true;
    const result = await new AuthService(ctx.deps).login({ email: 'a@b.com', password: fixturePassword });
    expect(result).toEqual({ twoFactorRequired: true, email: 'a@b.com' });
    expect(ctx.tokens).toHaveLength(0);
    expect(ctx.mocks.mail.send).toHaveBeenCalledOnce();
  });

  it('issues longer access and refresh token lifetimes when rememberMe is true', async () => {
    const rawPassword = fixturePassword;
    const standard = await new AuthService(ctx.deps).login({ email: 'a@b.com', password: rawPassword, rememberMe: false });
    const remembered = await new AuthService(ctx.deps).login({ email: 'a@b.com', password: rawPassword, rememberMe: true });
    if (standard.twoFactorRequired || remembered.twoFactorRequired) throw new Error('unexpected 2FA');

    const decodeExpDelta = (token: string) => {
      const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString('utf8')) as { iat: number; exp: number };
      return payload.exp - payload.iat;
    };

    expect(decodeExpDelta(remembered.session.accessToken)).toBe(30 * 24 * 60 * 60);
    expect(decodeExpDelta(remembered.session.accessToken)).toBeGreaterThan(decodeExpDelta(standard.session.accessToken));
    expect(remembered.session.refreshTokenExpiresAt.getTime()).toBeGreaterThan(
      standard.session.refreshTokenExpiresAt.getTime() + 20 * 24 * 60 * 60 * 1000,
    );
  });
});

describe('AuthService.register', () => {
  it('creates a PENDING account and sends an OTP', async () => {
    const ctx = makeDeps(null);
    ctx.mocks.users.findByEmail.mockResolvedValueOnce(null);
    const result = await new AuthService(ctx.deps).register({
      email: 'new@b.com',
      password: fixturePassword,
      fullName: 'New User',
      role: ROLES.TRAVELER,
    });
    expect(result.email).toBe('new@b.com');
    const created = ctx.mocks.users.create.mock.calls[0]![0];
    expect(created.status).toBe(USER_STATUS.PENDING_VERIFICATION);
    expect(bcrypt.compareSync(fixturePassword, created.passwordHash!)).toBe(true);
    expect(created).not.toHaveProperty('permissions');
    expect(ctx.mocks.mail.send).toHaveBeenCalledOnce();
  });

  it('refuses an email that already belongs to an active account', async () => {
    const ctx = makeDeps(makeUser());
    await expect(
      new AuthService(ctx.deps).register({ email: 'a@b.com', password: fixturePassword, fullName: 'Dup', role: ROLES.TRAVELER }),
    ).rejects.toBeInstanceOf(AppError);
    expect(ctx.mocks.users.create).not.toHaveBeenCalled();
  });
});

describe('AuthService.refresh', () => {
  it('rotates the token and revokes the whole family if an old token is replayed', async () => {
    const ctx = makeDeps(makeUser());
    const service = new AuthService(ctx.deps);
    const login = await service.login({ email: 'a@b.com', password: fixturePassword });
    if (login.twoFactorRequired) throw new Error('unexpected');

    const rotated = await service.refresh(login.session.refreshToken);
    expect(rotated.refreshToken).not.toBe(login.session.refreshToken);

    // replay of the first (now revoked) token => theft signal
    await expect(service.refresh(login.session.refreshToken)).rejects.toMatchObject({ code: ERROR_CODES.TOKEN_INVALID });
    // the legitimately rotated token is revoked too
    await expect(service.refresh(rotated.refreshToken)).rejects.toMatchObject({ code: ERROR_CODES.TOKEN_INVALID });
  });

  it('rejects when no token is supplied', async () => {
    const ctx = makeDeps(makeUser());
    await expect(new AuthService(ctx.deps).refresh(undefined)).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('AuthService.changePassword', () => {
  it.each(['missing', 'banned'] as const)('rejects a %s account without updating credentials', async (state) => {
    const ctx = makeDeps(state === 'missing' ? null : makeUser({ status: USER_STATUS.BANNED }));
    await expect(new AuthService(ctx.deps).changePassword('u1', {
      currentPassword: randomUUID(), newPassword: randomUUID(),
    })).rejects.toMatchObject({ statusCode: 401, code: ERROR_CODES.ACCOUNT_NOT_FOUND });
    expect(ctx.mocks.users.updateById).not.toHaveBeenCalled();
  });
});

describe('AuthService.forgotPassword', () => {
  it('answers identically for unknown emails and sends nothing', async () => {
    const ctx = makeDeps(null);
    const result = await new AuthService(ctx.deps).forgotPassword('ghost@b.com');
    expect(result.message).toMatch(/if the email is registered/i);
    expect(ctx.mocks.mail.send).not.toHaveBeenCalled();
  });
});

describe('AuthService account activation is a guarded transition', () => {
  const pending = () => makeDeps(makeUser({ status: USER_STATUS.PENDING_VERIFICATION }));

  it('verify-otp activates a pending account (compare-and-set on PENDING)', async () => {
    const ctx = pending();
    const session = await new AuthService(ctx.deps).verifyOtp({ email: 'a@b.com', code: '123456', purpose: OTP_PURPOSE.REGISTER });
    expect(session.user.status).toBe(USER_STATUS.ACTIVE);
    expect(ctx.mocks.users.updateStatusIf).toHaveBeenCalledWith('u1', USER_STATUS.PENDING_VERIFICATION, expect.anything());
  });

  it('a ban that lands between reading the account and activating it is NOT overwritten', async () => {
    const ctx = pending();
    // Like a real database, hand out a SNAPSHOT: later changes to the stored account are not visible through it.
    ctx.mocks.users.findByEmail.mockImplementation(async () => (ctx.store.user ? { ...ctx.store.user } : null));
    ctx.mocks.otp.verify.mockImplementationOnce(async () => {
      ctx.store.user!.status = USER_STATUS.BANNED; // moderator bans while the OTP is being verified
    });
    await expect(new AuthService(ctx.deps).verifyOtp({ email: 'a@b.com', code: '123456', purpose: OTP_PURPOSE.REGISTER })).rejects.toMatchObject({
      code: ERROR_CODES.ACCOUNT_BANNED,
    });
    expect(ctx.store.user!.status).toBe(USER_STATUS.BANNED);
  });

  it('Google login links and activates a pending account the same guarded way', async () => {
    const ctx = pending();
    ctx.mocks.google.verifyIdToken.mockResolvedValue({ googleId: 'g-1', email: 'a@b.com', emailVerified: true, fullName: 'A B' });
    const session = await new AuthService(ctx.deps).loginWithGoogle({ idToken: 'x'.repeat(20) });
    expect(session.user.status).toBe(USER_STATUS.ACTIVE);
    expect(ctx.mocks.users.updateStatusIf).toHaveBeenCalledOnce();
  });

  it('resetting a password never activates an account', async () => {
    const ctx = pending();
    await new AuthService(ctx.deps).resetPassword({ email: 'a@b.com', code: '123456', newPassword: 'N3wPassword!' });
    expect(ctx.store.user!.status).toBe(USER_STATUS.PENDING_VERIFICATION);
    expect(ctx.mocks.users.updateStatusIf).not.toHaveBeenCalled();
  });
});

describe('AuthService.loginAgencyWithGoogle', () => {
  it('links Google and signs in an existing Agency account with rememberMe duration', async () => {
    const googleSub = randomUUID();
    const idToken = randomUUID();
    const ctx = makeDeps(
      makeUser({
        role: ROLES.AGENCY,
        email: 'partner@example.com',
      }),
    );
    ctx.mocks.google.verifyIdToken.mockResolvedValue({
      googleId: googleSub,
      email: 'partner@example.com',
      emailVerified: true,
      fullName: 'Partner Owner',
      avatarUrl: 'https://example.com/avatar.png',
    });

    const session = await new AuthService(ctx.deps).loginAgencyWithGoogle({
      idToken,
      rememberMe: true,
    });

    const payload = JSON.parse(Buffer.from(session.accessToken.split('.')[1]!, 'base64url').toString('utf8')) as {
      iat: number;
      exp: number;
    };

    expect(session.user.role).toBe(ROLES.AGENCY);
    expect(payload.exp - payload.iat).toBe(30 * 24 * 60 * 60);
    expect(ctx.mocks.users.updateById).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ googleId: googleSub, avatarUrl: 'https://example.com/avatar.png' }),
    );
  });

  it('authenticates a personal account without workplaces through Partner Google', async () => {
    const travelerCtx = makeDeps(makeUser({ role: ROLES.TRAVELER, email: 'traveler@example.com' }));
    travelerCtx.mocks.google.verifyIdToken.mockResolvedValue({
      googleId: randomUUID(),
      email: 'traveler@example.com',
      emailVerified: true,
      fullName: 'Traveler',
    });

    const session = await new AuthService(travelerCtx.deps).loginAgencyWithGoogle({ idToken: randomUUID() });
    expect(session.user.role).toBe(ROLES.TRAVELER);
    expect(session.agencies).toEqual([]);
    expect(travelerCtx.mocks.users.create).not.toHaveBeenCalled();
  });

  it('creates a verified personal account for a new Partner Google identity', async () => {
    const emptyCtx = makeDeps(null);
    emptyCtx.mocks.google.verifyIdToken.mockResolvedValue({
      googleId: randomUUID(),
      email: 'unknown@example.com',
      emailVerified: true,
      fullName: 'Unknown',
    });

    const session = await new AuthService(emptyCtx.deps).loginAgencyWithGoogle({ idToken: randomUUID() });
    expect(session.user.role).toBe(ROLES.TRAVELER);
    expect(session.agencies).toEqual([]);
    expect(emptyCtx.mocks.users.create).toHaveBeenCalledWith(expect.objectContaining({ role: ROLES.TRAVELER, status: USER_STATUS.ACTIVE }));
  });
});

describe('Partner login before the first workplace', () => {
  it('opens a personal session without requiring membership', async () => {
    const ctx = makeDeps(makeUser());
    const result = await new AuthService(ctx.deps).loginAgency({ email: 'a@b.com', password: fixturePassword });
    expect(result.twoFactorRequired).toBe(false);
    if (!result.twoFactorRequired) expect(result.session.agencies).toEqual([]);
  });
  it('requires email verification without requiring a business profile', async () => {
    const ctx = makeDeps(makeUser({ status: USER_STATUS.PENDING_VERIFICATION }));
    await expect(new AuthService(ctx.deps).loginAgency({ email: 'a@b.com', password: fixturePassword })).rejects.toMatchObject({ code: ERROR_CODES.ACCOUNT_NOT_VERIFIED });
    expect(ctx.tokens).toHaveLength(0);
    expect(ctx.mocks.otp.issue).toHaveBeenCalledWith('u1', OTP_PURPOSE.REGISTER);
  });
  it('requires 2FA and permits verification without a membership', async () => {
    const ctx = makeDeps(makeUser({ twoFactorEnabled: true }));
    const service = new AuthService(ctx.deps);
    expect(await service.loginAgency({ email: 'a@b.com', password: fixturePassword })).toMatchObject({ twoFactorRequired: true });
    expect(ctx.tokens).toHaveLength(0);
    const verified = await service.verifyAgencyOtp({ email: 'a@b.com', code: '123456', purpose: OTP_PURPOSE.LOGIN_2FA });
    expect(verified.registrationComplete).toBe(false);
    expect(ctx.tokens).toHaveLength(1);
  });
  it('keeps a banned account out of the Partner portal', async () => {
    const ctx = makeDeps(makeUser({ status: USER_STATUS.BANNED }));
    await expect(new AuthService(ctx.deps).loginAgency({ email: 'a@b.com', password: fixturePassword })).rejects.toMatchObject({ code: ERROR_CODES.ACCOUNT_BANNED });
    expect(ctx.tokens).toHaveLength(0);
  });
  it('keeps rememberMe duration through the common OTP completion', async () => {
    const ctx = makeDeps(makeUser({ twoFactorEnabled: true }));
    const session = await new AuthService(ctx.deps).verifyOtp({ email: 'a@b.com', code: '123456', purpose: OTP_PURPOSE.LOGIN_2FA, rememberMe: true });
    const payload = JSON.parse(Buffer.from(session.accessToken.split('.')[1]!, 'base64url').toString('utf8'));
    expect(payload.exp - payload.iat).toBe(30 * 86400);
  });
});
