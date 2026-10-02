import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app';
import { env } from '../../config/env';
import { errorHandler } from '../../middlewares/error-handler';
import { ConsoleMailProvider } from '../../integrations/mail';
import { logger } from '../../utils/logger';
import { UserModel } from '../../modules/users/users.model';
import {
  PASSWORD,
  bearer,
  captureMail,
  createUser,
  registerAndVerify,
  resetDatabase,
  startDatabase,
  stopDatabase,
} from '../../test/integration';

// Real Express app + real MongoDB: what an attacker (or a curious client) can learn or do through HTTP.
const app = createApp();
const mail = captureMail();

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);

const signAs = (sub: string, role: string, options: jwt.SignOptions & { secret?: string } = {}) => {
  const { secret = env.JWT_ACCESS_SECRET, ...rest } = options;
  return jwt.sign({ sub, role }, secret, { algorithm: 'HS256', issuer: 'tripri-api', expiresIn: '5m', ...rest });
};

describe('tokens and sessions', () => {
  it('rejects forged, unsigned, expired, foreign-issuer and wrong-secret tokens', async () => {
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    const probe = (token: string) => request(app).get('/api/v1/users/me').set(bearer(token));

    expect((await probe(traveler.token)).status).toBe(200);

    const unsigned = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(
      JSON.stringify({ sub: traveler.id, role: 'SUPER_ADMIN', iss: 'tripri-api' }),
    ).toString('base64url')}.`;
    const forged = [
      unsigned,
      signAs(traveler.id, 'TRAVELER', { secret: 'not-the-real-secret-0123456789abcdef' }),
      signAs(traveler.id, 'TRAVELER', { secret: env.JWT_REFRESH_SECRET }), // refresh secret must not validate access tokens
      signAs(traveler.id, 'TRAVELER', { issuer: 'someone-else' }),
      signAs(traveler.id, 'TRAVELER', { expiresIn: -10 }),
      jwt.sign({ sub: traveler.id, role: 'TRAVELER' }, env.JWT_ACCESS_SECRET, { algorithm: 'HS512', issuer: 'tripri-api' }),
      'Bearer',
      '',
    ];
    for (const token of forged) {
      const res = await probe(token);
      expect(res.status, token.slice(0, 30)).toBe(401);
    }
  });

  it('the role inside a (validly signed) token is ignored: permissions always come from the database', async () => {
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    const lying = signAs(traveler.id, 'SUPER_ADMIN');

    const admin = await request(app).get('/api/v1/admin/users').set(bearer(lying));
    expect(admin.status).toBe(403);
    expect((await request(app).get('/api/v1/moderation/tours').set(bearer(lying))).status).toBe(403);
  });

  it('a token of a deleted account or a demoted staff member stops working at once', async () => {
    const moderator = await createUser('MODERATOR', 'mod@example.com');
    expect((await request(app).get('/api/v1/moderation/tours').set(bearer(moderator.token))).status).toBe(200);

    await UserModel.updateOne({ _id: moderator.id }, { $set: { role: 'TRAVELER' } });
    expect((await request(app).get('/api/v1/moderation/tours').set(bearer(moderator.token))).status).toBe(403);

    await UserModel.deleteOne({ _id: moderator.id });
    expect((await request(app).get('/api/v1/users/me').set(bearer(moderator.token))).status).toBe(401);
  });

  it('the refresh cookie is HttpOnly, SameSite and scoped to the auth path; the token never appears in the JSON body', async () => {
    const session = await registerAndVerify(app, mail, 'cookie@example.com');
    const cookie = session.cookies.find((c) => c.startsWith('refreshToken') || c.includes('refresh'))!;
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=(Lax|Strict|None)/i);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);

    const login = await request(app).post('/api/v1/auth/login').send({ email: 'cookie@example.com', password: PASSWORD });
    expect(JSON.stringify(login.body)).not.toMatch(/refresh/i);
  });
});

describe('no information leaks', () => {
  it('wrong password and unknown email are indistinguishable; forgot-password answers the same for both', async () => {
    await registerAndVerify(app, mail, 'known@example.com');
    const known = await request(app).post('/api/v1/auth/login').send({ email: 'known@example.com', password: 'WrongPass123' });
    const unknown = await request(app).post('/api/v1/auth/login').send({ email: 'ghost@example.com', password: 'WrongPass123' });
    expect(known.status).toBe(unknown.status);
    expect(known.body).toEqual(unknown.body);

    const a = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'known@example.com' });
    const b = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'ghost@example.com' });
    expect(a.status).toBe(b.status);
    expect(a.body).toEqual(b.body);
    expect(mail.outbox.some((m) => m.to === 'ghost@example.com')).toBe(false);
  });

  it('responses never contain password hashes, token hashes, OTP hashes or private contact data of others', async () => {
    const session = await registerAndVerify(app, mail, 'me@example.com');
    const admin = await createUser('SUPER_ADMIN', 'admin@example.com');
    const guide = await createUser('TOUR_GUIDE', 'guide@example.com', { phone: '+84 900 000 111', fullName: 'Le Van Guide' });

    const bodies = [
      (await request(app).get('/api/v1/users/me').set(bearer(session.token))).body,
      (await request(app).get('/api/v1/admin/users').set(bearer(admin.token))).body,
      (await request(app).get(`/api/v1/tour-guides/${guide.id}`)).body,
      (await request(app).post('/api/v1/auth/login').send({ email: 'me@example.com', password: PASSWORD })).body,
    ];
    const text = JSON.stringify(bodies);
    expect(text).not.toMatch(/passwordHash|tokenHash|codeHash|\$2[aby]\$/);
    expect(JSON.stringify(bodies[2])).not.toMatch(/guide@example\.com|\+84 900/); // public profile: no email / phone
  });

  it('internal errors, bad JSON and oversized bodies answer in the standard envelope without stack traces', async () => {
    const crashing = express();
    crashing.get('/boom', () => {
      throw new Error('mongodb://admin:hunter2@db.internal:27017 refused the connection');
    });
    crashing.use(errorHandler);
    const boom = await request(crashing).get('/boom');
    expect(boom.status).toBe(500);
    expect(JSON.stringify(boom.body)).not.toMatch(/hunter2|mongodb:|\.ts:|at \w+/);
    expect(boom.body).toEqual({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });

    const badJson = await request(app).post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{"email": ');
    expect(badJson.status).toBe(400);
    expect(JSON.stringify(badJson.body)).not.toMatch(/Unexpected|position|SyntaxError/);

    const huge = await request(app).post('/api/v1/auth/login').send({ email: 'a@example.com', password: 'x'.repeat(2_000_000) });
    expect(huge.status).toBe(413);
    expect(huge.body).toEqual({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Payload too large' } });
  });

  it('answers with helmet headers, no x-powered-by, and CORS only for the configured client origin', async () => {
    const res = await request(app).get('/api/v1/health').set('Origin', 'http://localhost:3000');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(res.headers['access-control-allow-credentials']).toBe('true');

    const evil = await request(app).get('/api/v1/health').set('Origin', 'https://evil.example');
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
    const preflight = await request(app)
      .options('/api/v1/bookings')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('the console mail fallback never logs the body (OTP codes) in production', async () => {
    const info = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    const message = { to: 'a@example.com', subject: 'Your code', text: 'Use this code: 123456' };

    await new ConsoleMailProvider(false).send(message);
    expect(info.mock.calls.map((c) => c[0]).join('\n')).not.toContain('123456');

    await new ConsoleMailProvider(true).send(message); // development convenience
    expect(info.mock.calls.map((c) => c[0]).join('\n')).toContain('123456');
    info.mockRestore();
  });
});

describe('injection through HTTP (real database)', () => {
  it('operator objects in bodies and queries are rejected or treated as plain text, never executed', async () => {
    const victim = await createUser('TRAVELER', 'victim@example.com');
    await UserModel.updateOne({ _id: victim.id }, { $set: { passwordHash: '$2b$04$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuvwxyz0123' } });

    const attacks = [
      request(app).post('/api/v1/auth/login').send({ email: { $ne: null }, password: { $ne: null } }),
      request(app).post('/api/v1/auth/login').send({ email: 'victim@example.com', password: { $gt: '' } }),
      request(app).post('/api/v1/auth/forgot-password').send({ email: { $regex: '.*' } }),
      request(app).post('/api/v1/auth/verify-otp').send({ email: { $ne: '' }, code: { $ne: '' }, purpose: 'REGISTER' }),
    ];
    for (const res of await Promise.all(attacks)) {
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }

    // Express' query parser does not build objects from `a[$ne]=1`: the key stays a harmless literal and is ignored,
    // so the answer must be exactly the unfiltered one - an operator is never interpreted.
    const admin = await createUser('SUPER_ADMIN', 'admin@example.com');
    await createUser('TRAVELER', 'one@example.com');
    await createUser('MODERATOR', 'two@example.com');
    const everyone = await request(app).get('/api/v1/admin/users').set(bearer(admin.token));
    expect(everyone.body.data).toHaveLength(4); // victim, admin, traveler, moderator
    for (const url of ['/api/v1/admin/users?role[$ne]=TRAVELER', '/api/v1/admin/users?status[$ne]=BANNED', '/api/v1/admin/users?email[$regex]=.*']) {
      const res = await request(app).get(url).set(bearer(admin.token));
      expect(res.status, url).toBe(200);
      expect(res.body.data.map((u: { id: string }) => u.id).sort(), url).toEqual(everyone.body.data.map((u: { id: string }) => u.id).sort());
    }
    for (const url of ['/api/v1/tours?q[$regex]=.*&sort[$ne]=x', '/api/v1/tours?categoryId[$ne]=1', '/api/v1/tours?minPrice[$gt]=0']) {
      expect((await request(app).get(url)).status, url).toBeLessThan(500);
    }
    // A scalar filter that IS known but malformed is refused outright.
    expect((await request(app).get('/api/v1/admin/users?role=$ne').set(bearer(admin.token))).status).toBe(400);
    expect((await request(app).get('/api/v1/reviews?tourId=$ne')).status).toBe(400);

    // A regex-looking search term is matched literally, so it cannot be used to dump the catalogue or hang the database.
    const literal = await request(app).get('/api/v1/tours').query({ q: '.*' });
    expect(literal.status).toBe(200);
    expect(literal.body.data).toEqual([]);
    const evilRegex = await request(app).get('/api/v1/tours').query({ q: '(a+)+$' + 'a'.repeat(50) });
    expect(evilRegex.status).toBe(200);
  });

  it('object ids in the path are validated before they reach the database', async () => {
    const admin = await createUser('SUPER_ADMIN', 'admin@example.com');
    for (const id of ['not-an-id', '{"$ne":1}', '..%2F..%2Fetc', '64b0000000000000000000'.padEnd(30, '0')]) {
      const res = await request(app).get(`/api/v1/tours/${id}`);
      expect(res.status, id).toBe(400);
    }
    expect((await request(app).patch('/api/v1/admin/users/not-an-id/access').set(bearer(admin.token)).send({ role: 'TRAVELER' })).status).toBe(400);
  });
});
