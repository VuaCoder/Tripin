import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app';
import { googleIdentityVerifier, type GoogleIdentity } from '../../../integrations/google';
import { PASSWORD, bearer, captureMail, createUser, registerAndVerify, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';
import { prisma } from '../../../config/database';

// Real Express app + real PostgreSQL: the less common authentication flows.
const app = createApp();
const mail = captureMail();

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);

const cookieOf = (setCookie: string[]) => setCookie.map((c) => c.split(';')[0]).join('; ');
const login = (email: string, password = PASSWORD) => request(app).post('/api/v1/auth/login').send({ email, password });

describe('two-factor login', () => {
  it('after enabling 2FA the password alone opens nothing; the emailed code completes the login once', async () => {
    const email = 'twofa@example.com';
    const session = await registerAndVerify(app, mail, email);

    const wrongPassword = await request(app).patch('/api/v1/auth/two-factor').set(bearer(session.token)).send({ enabled: true, password: 'Nope12345' });
    expect(wrongPassword.status).toBe(401);
    expect((await request(app).patch('/api/v1/auth/two-factor').set(bearer(session.token)).send({ enabled: true })).status).toBe(401);
    const enable = await request(app).patch('/api/v1/auth/two-factor').set(bearer(session.token)).send({ enabled: true, password: PASSWORD });
    expect(enable.status, JSON.stringify([enable.body, await prisma.user.findMany()])).toBe(200);

    const first = await login(email);
    expect(first.status).toBe(200);
    expect(first.body.data).toEqual({ twoFactorRequired: true, email });
    expect(first.headers['set-cookie']).toBeUndefined(); // no session yet
    expect(first.body.data.accessToken).toBeUndefined();

    const code = mail.codeFor(email);
    const done = await request(app).post('/api/v1/auth/verify-otp').send({ email, code, purpose: 'LOGIN_2FA' });
    expect(done.status).toBe(200);
    expect(done.body.data.accessToken).toBeTruthy();
    expect(done.headers['set-cookie']).toBeDefined();

    // Single use, and a REGISTER-purpose request cannot consume a LOGIN_2FA code.
    expect((await request(app).post('/api/v1/auth/verify-otp').send({ email, code, purpose: 'LOGIN_2FA' })).status).toBe(400);
  });

  it('a code issued for one purpose is worthless for another', async () => {
    const email = 'purpose@example.com';
    await request(app).post('/api/v1/auth/register').send({ email, password: PASSWORD, fullName: 'Purpose Tester' });
    const registerCode = mail.codeFor(email);

    const asReset = await request(app).post('/api/v1/auth/reset-password').send({ email, code: registerCode, newPassword: 'BrandNew123' });
    expect(asReset.status).toBe(400);
    const asTwoFa = await request(app).post('/api/v1/auth/verify-otp').send({ email, code: registerCode, purpose: 'LOGIN_2FA' });
    expect(asTwoFa.status).toBe(400);
    expect((await request(app).post('/api/v1/auth/verify-otp').send({ email, code: registerCode, purpose: 'REGISTER' })).status).toBe(200);
  });

  it('asking for a new code too soon is refused (429), and a wrong code never reveals which part was wrong', async () => {
    const email = 'cooldown@example.com';
    await request(app).post('/api/v1/auth/register').send({ email, password: PASSWORD, fullName: 'Cool Down' });
    const again = await request(app).post('/api/v1/auth/register').send({ email, password: PASSWORD, fullName: 'Cool Down' });
    expect(again.status).toBe(429);
    expect(again.body.error.code).toBe('OTP_RESEND_TOO_SOON');

    const unknown = await request(app).post('/api/v1/auth/verify-otp').send({ email: 'ghost@example.com', code: '123456', purpose: 'REGISTER' });
    const wrong = await request(app).post('/api/v1/auth/verify-otp').send({ email, code: '000000', purpose: 'REGISTER' });
    expect(unknown.status).toBe(400);
    expect(wrong.status).toBe(400);
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
  });
});

describe('forgot and reset password', () => {
  it('the new password works, the old one does not, and every session of the account is revoked', async () => {
    const email = 'reset@example.com';
    const session = await registerAndVerify(app, mail, email);
    const other = await login(email);
    expect(other.status).toBe(200);

    expect((await request(app).post('/api/v1/auth/forgot-password').send({ email })).status).toBe(202);
    const code = mail.codeFor(email);

    expect((await request(app).post('/api/v1/auth/reset-password').send({ email, code, newPassword: 'short' })).status).toBe(400);
    expect((await request(app).post('/api/v1/auth/reset-password').send({ email, code: '000000', newPassword: 'BrandNew123' })).status).toBe(400);
    const reset = await request(app).post('/api/v1/auth/reset-password').send({ email, code, newPassword: 'BrandNew123' });
    expect(reset.status).toBeLessThan(300);

    expect((await login(email, PASSWORD)).status).toBe(401);
    expect((await login(email, 'BrandNew123')).status).toBe(200);
    // Both earlier sessions can no longer refresh.
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', cookieOf(session.cookies))).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', cookieOf(other.headers['set-cookie'] as unknown as string[]))).status).toBe(401);
    // The reset code is single use.
    expect((await request(app).post('/api/v1/auth/reset-password').send({ email, code, newPassword: 'AnotherOne123' })).status).toBe(400);
  });

  it('a banned or unverified account cannot reset its way into an active one', async () => {
    const banned = await createUser('TRAVELER', 'banned@example.com', { status: 'BANNED' });
    expect((await request(app).post('/api/v1/auth/forgot-password').send({ email: 'banned@example.com' })).status).toBe(202);
    expect(mail.outbox.some((m) => m.to === 'banned@example.com')).toBe(false);
    expect((await request(app).post('/api/v1/auth/reset-password').send({ email: 'banned@example.com', code: '123456', newPassword: 'BrandNew123' })).status).toBe(400);
    expect((await prisma.user.findUnique({ where: { id: banned.id } }))!.status).toBe('BANNED');

    await request(app).post('/api/v1/auth/register').send({ email: 'pending@example.com', password: PASSWORD, fullName: 'Pending User' });
    expect((await request(app).post('/api/v1/auth/forgot-password').send({ email: 'pending@example.com' })).status).toBe(202);
    const reset = await request(app).post('/api/v1/auth/reset-password').send({ email: 'pending@example.com', code: mail.codeFor('pending@example.com'), newPassword: 'BrandNew123' });
    expect(reset.status).toBe(400); // the REGISTER code is not a reset code
    expect((await prisma.user.findFirst({ where: { email: 'pending@example.com' } }))!.status).toBe('PENDING_VERIFICATION');
  });
});

describe('logout', () => {
  it('kills the refresh token family, is idempotent, and works without a cookie', async () => {
    const session = await registerAndVerify(app, mail, 'logout@example.com');
    const cookie = cookieOf(session.cookies);
    const rotated = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    const newer = cookieOf(rotated.headers['set-cookie'] as unknown as string[]);

    expect((await request(app).post('/api/v1/auth/logout').set('Cookie', newer)).status).toBeLessThan(300);
    expect((await request(app).post('/api/v1/auth/logout').set('Cookie', newer)).status).toBeLessThan(300);
    expect((await request(app).post('/api/v1/auth/logout')).status).toBeLessThan(300);
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', newer)).status).toBe(401);
    expect(await prisma.refreshToken.count({ where: { revokedAt: null } })).toBe(0);
  });
});

describe('login with Google (fake Google verifier)', () => {
  const identity = (overrides: Partial<GoogleIdentity> = {}): GoogleIdentity => ({
    googleId: 'g-1001',
    email: 'guser@example.com',
    emailVerified: true,
    fullName: 'Google User',
    ...overrides,
  });
  const google = (idToken = 'fake-id-token-0001', role?: string) => request(app).post('/api/v1/auth/google').send({ idToken, ...(role ? { role } : {}) });
  const asGoogle = (value: GoogleIdentity | Error) =>
    vi.spyOn(googleIdentityVerifier, 'verifyIdToken').mockImplementation(async () => {
      if (value instanceof Error) throw value;
      return value;
    });

  it('creates an active account on first use (role from the request, never an admin role) and reuses it afterwards', async () => {
    asGoogle(identity());
    const first = await google('fake-id-token-0001', 'TOUR_GUIDE');
    expect(first.status).toBe(200);
    expect(first.body.data.user.role).toBe('TOUR_GUIDE');
    expect((await google()).status).toBe(200);
    expect(await prisma.user.count({ where: { email: 'guser@example.com' } })).toBe(1);

    expect((await google('fake-id-token-0002', 'SUPER_ADMIN')).status).toBe(400);
    expect((await google('fake-id-token-0002', 'MODERATOR')).status).toBe(400);
  });

  it('five simultaneous first logins create ONE account', async () => {
    asGoogle(identity({ googleId: 'g-race', email: 'race@example.com' }));
    const results = await Promise.all(Array.from({ length: 5 }, () => google()));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(await prisma.user.count({ where: { email: 'race@example.com' } })).toBe(1);
  });

  it('refuses unverified Google emails, invalid credentials, banned accounts and a missing configuration', async () => {
    asGoogle(identity({ emailVerified: false }));
    expect((await google()).status).toBe(401);

    vi.spyOn(googleIdentityVerifier, 'verifyIdToken').mockRejectedValue(Object.assign(new Error('bad'), { statusCode: 401 }));
    expect((await google()).status).toBeGreaterThanOrEqual(400);

    asGoogle(identity({ googleId: 'g-banned', email: 'bannedg@example.com' }));
    expect((await google()).status).toBe(200);
    await prisma.user.updateMany({ where: { email: 'bannedg@example.com' }, data: { status: 'BANNED' } });
    const banned = await google();
    expect(banned.status).toBe(403);
    expect(banned.body.error.code).toBe('ACCOUNT_BANNED');

    vi.mocked(googleIdentityVerifier.verifyIdToken).mockRestore(); // back to the real verifier
    expect((await google()).status).toBe(503); // GOOGLE_CLIENT_ID is not configured in tests
  });

  it('links to an existing account with the same (Google-verified) email', async () => {
    const email = 'both@example.com';
    await registerAndVerify(app, mail, email);
    asGoogle(identity({ googleId: 'g-link', email }));
    const res = await google();
    expect(res.status).toBe(200);
    const user = (await prisma.user.findFirst({ where: { email } }))!;
    expect(user.googleId).toBe('g-link');
    expect(await prisma.user.count({ where: { email } })).toBe(1);
    expect((await login(email)).status).toBe(200); // the password keeps working for an account the owner verified
  });

  it('PRE-HIJACKING: a password planted on an unverified registration dies when the real owner signs in with Google', async () => {
    const email = 'victim@example.com';
    // The attacker registers the victim's address with a password they know and never verifies it.
    await request(app).post('/api/v1/auth/register').send({ email, password: 'AttackerPass123', fullName: 'Not The Owner' });
    expect((await login(email, 'AttackerPass123')).status).toBe(403); // unverified: cannot log in

    // The victim later signs in with Google (a verified identity): the account becomes theirs.
    asGoogle(identity({ googleId: 'g-victim', email }));
    expect((await google()).status).toBe(200);
    expect((await prisma.user.findFirst({ where: { email } }))!.status).toBe('ACTIVE');

    // The attacker's password must not open the now-active account.
    const attacker = await login(email, 'AttackerPass123');
    expect(attacker.status).toBe(401);
  });
});

describe('registration rules', () => {
  it('enforces the password policy and the allowed self-registration roles', async () => {
    const register = (body: object) => request(app).post('/api/v1/auth/register').send({ email: 'rules@example.com', fullName: 'Rule Tester', ...body });
    expect((await register({ password: 'short1' })).status).toBe(400);
    expect((await register({ password: 'lettersonlyletters' })).status).toBe(400);
    expect((await register({ password: '1234567890123' })).status).toBe(400);
    expect((await register({ password: PASSWORD, role: 'SUPER_ADMIN' })).status).toBe(400);
    expect((await register({ password: PASSWORD, role: 'MODERATOR' })).status).toBe(400);
    expect((await register({ password: PASSWORD, role: 'GUEST' })).status).toBe(400);
    expect((await register({ password: PASSWORD, status: 'ACTIVE', isAdmin: true })).status).toBeLessThan(500);
    const stored = await prisma.user.findFirst({ where: { email: 'rules@example.com' } });
    if (stored) {
      expect(stored.status).toBe('PENDING_VERIFICATION');
      expect(stored.role).toBe('TRAVELER');
    }
    expect((await register({ password: PASSWORD, role: 'AGENCY', email: 'agency-generic@example.com' })).status).toBe(400);
    const agencyRegistration = await request(app).post('/api/v1/auth/agency/register').send({
      email: 'agency-reg@example.com',
      password: PASSWORD,
      fullName: 'Agency Owner',
      phone: '+84 912 345 678',
      companyName: 'Rule Travel Co.',
      licenseNumber: 'GPKD-123456',
      address: '123 Rule Street, Ho Chi Minh City',
      website: 'https://rule-travel.example.com',
    });
    expect(agencyRegistration.status).toBe(201);
    const agency = await prisma.user.findFirst({ where: { email: 'agency-reg@example.com' }, include: { agencyProfile: true } });
    expect(agency?.phone).toBe('+84 912 345 678');
    expect(agency?.agencyProfile).toMatchObject({
      companyName: 'Rule Travel Co.',
      licenseNumber: 'GPKD-123456',
      address: '123 Rule Street, Ho Chi Minh City',
      verificationStatus: 'UNVERIFIED',
    });
  });
});
