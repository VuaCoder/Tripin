import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import { PASSWORD, bearer, captureMail, registerAndVerify, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';
import { prisma } from '../../../config/database';

// Real Express app + real PostgreSQL: register -> OTP -> session -> refresh rotation -> ban.
const app = createApp();
const mail = captureMail();

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);

const cookieOf = (setCookie: string[]) => setCookie.map((c) => c.split(';')[0]).join('; ');

describe('auth (integration)', () => {
  it('registers, verifies the OTP once and opens a session', async () => {
    const email = 'an@example.com';
    const session = await registerAndVerify(app, mail, email);

    const stored = await prisma.user.findFirst({ where: { email } });
    expect(stored?.status).toBe('ACTIVE');
    expect(stored?.passwordHash).not.toBe(PASSWORD);

    const replay = await request(app).post('/api/v1/auth/verify-otp').send({ email, code: mail.codeFor(email), purpose: 'REGISTER' });
    expect(replay.status).toBe(400); // the OTP is single use

    const logout = await request(app).post('/api/v1/auth/logout').set('Cookie', cookieOf(session.cookies));
    expect(logout.status).toBeLessThan(300);
  });

  it('refuses a duplicate email and login before verification', async () => {
    const email = 'binh@example.com';
    await request(app).post('/api/v1/auth/register').send({ email, password: PASSWORD, fullName: 'Binh' });

    const early = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
    expect(early.status).toBe(403);
    expect(early.body.error.code).toBe('ACCOUNT_NOT_VERIFIED');

    const verified = await request(app).post('/api/v1/auth/verify-otp').send({ email, code: mail.codeFor(email), purpose: 'REGISTER' });
    expect(verified.status).toBe(200);
    const again = await request(app).post('/api/v1/auth/register').send({ email, password: PASSWORD, fullName: 'Binh' });
    expect(again.status).toBe(409);
  });

  it('locks the OTP after too many wrong guesses', async () => {
    const email = 'chi@example.com';
    await request(app).post('/api/v1/auth/register').send({ email, password: PASSWORD, fullName: 'Chi' });
    const real = mail.codeFor(email);
    const wrong = real === '000000' ? '111111' : '000000';

    let last = 0;
    for (let i = 0; i < 8; i += 1) {
      last = (await request(app).post('/api/v1/auth/verify-otp').send({ email, code: wrong, purpose: 'REGISTER' })).status;
    }
    expect(last).toBe(429);
    const right = await request(app).post('/api/v1/auth/verify-otp').send({ email, code: real, purpose: 'REGISTER' });
    expect(right.status).not.toBe(200);
  });

  it('rotates the refresh token and revokes the whole family on reuse', async () => {
    const email = 'dung@example.com';
    const session = await registerAndVerify(app, mail, email);
    const first = cookieOf(session.cookies);

    const rotated = await request(app).post('/api/v1/auth/refresh').set('Cookie', first);
    expect(rotated.status).toBe(200);
    const second = cookieOf(rotated.headers['set-cookie'] as unknown as string[]);
    expect(second).not.toBe(first);

    // Replaying the old (revoked) token is theft evidence: it fails AND kills the newer token.
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', first)).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', second)).status).toBe(401);
    expect(await prisma.refreshToken.count({ where: { revokedAt: null } })).toBe(0);
  });

  it('parallel refreshes with the same token yield exactly one session', async () => {
    const session = await registerAndVerify(app, mail, 'em@example.com');
    const cookie = cookieOf(session.cookies);

    const results = await Promise.all(Array.from({ length: 6 }, () => request(app).post('/api/v1/auth/refresh').set('Cookie', cookie)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
  });

  it('a ban takes effect on the very next request, even with a valid access token', async () => {
    const email = 'giang@example.com';
    const session = await registerAndVerify(app, mail, email);

    const before = await request(app).patch('/api/v1/auth/two-factor').set(bearer(session.token)).send({ enabled: false, password: PASSWORD });
    expect(before.status).not.toBe(401);

    await prisma.user.updateMany({ where: { email }, data: { status: 'BANNED' } });
    const after = await request(app).patch('/api/v1/auth/two-factor').set(bearer(session.token)).send({ enabled: false, password: PASSWORD });
    expect(after.status).toBe(403);

    const login = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
    expect(login.status).toBe(403);
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', cookieOf(session.cookies))).status).toBe(401);
  });
});
