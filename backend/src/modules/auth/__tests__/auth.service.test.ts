import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OTP_PURPOSE, ROLES, USER_STATUS } from '@travel-platform/constants';
import { AppError, ERROR_CODES } from '../../../utils/app-error';
import { AuthService, type AuthDeps } from '../auth.service';

interface FakeUser {
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
    id: 'u1',
    _id: 'u1',
    email: 'a@b.com',
    fullName: 'A B',
    role: ROLES.TRAVELER,
    status: USER_STATUS.ACTIVE,
    passwordHash: bcrypt.hashSync('Passw0rdX', 4),
    twoFactorEnabled: false,
    extraPermissions: [],
    createdAt: new Date(),
    ...overrides,
  };
}

function makeDeps(user: FakeUser | null) {
  const store = { user };
  const tokens: { hash: string; family: string; revokedAt?: Date; expiresAt: Date; userId: string; id: string }[] = [];

  const deps = {
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
      updateStatusIf: vi.fn(async (_id: string, expected: string, update: Record<string, unknown>) => {
        if (!store.user || store.user.status !== expected) return null;
        Object.assign(store.user, update);
        return store.user;
      }),
    },
    refreshTokens: {
      create: vi.fn(async (data: { tokenHash: string; family: string; expiresAt: Date; userId: string }) => {
        tokens.push({ hash: data.tokenHash, family: data.family, expiresAt: data.expiresAt, userId: data.userId, id: `t${tokens.length}` });
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
    const result = await new AuthService(ctx.deps).login({ email: 'a@b.com', password: 'Passw0rdX' });
    expect(result.twoFactorRequired).toBe(false);
    if (!result.twoFactorRequired) {
      expect(result.session.accessToken).toBeTruthy();
      expect(result.session.user.role).toBe(ROLES.TRAVELER);
    }
    expect(ctx.tokens).toHaveLength(1);
  });

  it('rejects a wrong password with the generic credentials error', async () => {
    await expect(new AuthService(ctx.deps).login({ email: 'a@b.com', password: 'nope-nope1' })).rejects.toMatchObject({
      statusCode: 401,
      code: ERROR_CODES.INVALID_CREDENTIALS,
    });
  });

  it('rejects an unknown email with the same error', async () => {
    const empty = makeDeps(null);
    await expect(new AuthService(empty.deps).login({ email: 'x@y.com', password: 'Passw0rdX' })).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_CREDENTIALS,
    });
  });

  it('blocks banned accounts', async () => {
    ctx.store.user!.status = USER_STATUS.BANNED;
    await expect(new AuthService(ctx.deps).login({ email: 'a@b.com', password: 'Passw0rdX' })).rejects.toMatchObject({
      statusCode: 403,
      code: ERROR_CODES.ACCOUNT_BANNED,
    });
  });

  it('asks unverified accounts to verify and re-sends the code', async () => {
    ctx.store.user!.status = USER_STATUS.PENDING_VERIFICATION;
    await expect(new AuthService(ctx.deps).login({ email: 'a@b.com', password: 'Passw0rdX' })).rejects.toMatchObject({
      code: ERROR_CODES.ACCOUNT_NOT_VERIFIED,
    });
    expect(ctx.mocks.otp.issue).toHaveBeenCalledWith('u1', OTP_PURPOSE.REGISTER);
  });

  it('requires an OTP step when 2FA is enabled and issues no session yet', async () => {
    ctx.store.user!.twoFactorEnabled = true;
    const result = await new AuthService(ctx.deps).login({ email: 'a@b.com', password: 'Passw0rdX' });
    expect(result).toEqual({ twoFactorRequired: true, email: 'a@b.com' });
    expect(ctx.tokens).toHaveLength(0);
    expect(ctx.mocks.mail.send).toHaveBeenCalledOnce();
  });
});

describe('AuthService.register', () => {
  it('creates a PENDING account and sends an OTP', async () => {
    const ctx = makeDeps(null);
    ctx.mocks.users.findByEmail.mockResolvedValueOnce(null);
    const result = await new AuthService(ctx.deps).register({
      email: 'new@b.com',
      password: 'Passw0rdX',
      fullName: 'New User',
      role: ROLES.AGENCY,
    });
    expect(result.email).toBe('new@b.com');
    const created = ctx.mocks.users.create.mock.calls[0]![0];
    expect(created.status).toBe(USER_STATUS.PENDING_VERIFICATION);
    expect(created).not.toHaveProperty('permissions');
    expect(ctx.mocks.mail.send).toHaveBeenCalledOnce();
  });

  it('refuses an email that already belongs to an active account', async () => {
    const ctx = makeDeps(makeUser());
    await expect(
      new AuthService(ctx.deps).register({ email: 'a@b.com', password: 'Passw0rdX', fullName: 'Dup', role: ROLES.TRAVELER }),
    ).rejects.toBeInstanceOf(AppError);
    expect(ctx.mocks.users.create).not.toHaveBeenCalled();
  });
});

describe('AuthService.refresh', () => {
  it('rotates the token and revokes the whole family if an old token is replayed', async () => {
    const ctx = makeDeps(makeUser());
    const service = new AuthService(ctx.deps);
    const login = await service.login({ email: 'a@b.com', password: 'Passw0rdX' });
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
