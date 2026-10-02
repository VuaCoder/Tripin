import express from 'express';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../../middlewares/error-handler';
import { validate, validated } from '../../middlewares/validate';
import { loginBody, registerBody } from '../../modules/auth/auth.validation';
import { assignAccessBody, updateProfileBody } from '../../modules/users/users.validation';
import { createBookingBody } from '../../modules/bookings/bookings.validation';
import { searchToursQuery } from '../../modules/tours/tours.validation';
import { containsRegex, escapeRegex } from '../../utils/regex';

const modulesDir = path.resolve(process.cwd(), 'src/modules');
const validationFiles = readdirSync(modulesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((entry) => readdirSync(path.join(modulesDir, entry.name)).filter((f) => f.endsWith('.validation.ts')).map((f) => path.join(modulesDir, entry.name, f)));

describe('validation schemas are bounded (source scan)', () => {
  it('finds the validation files', () => {
    expect(validationFiles.length).toBeGreaterThan(15);
  });

  it('no z.string() / z.array() is left without an upper bound or a pattern', () => {
    const offenders: string[] = [];
    for (const file of validationFiles) {
      readFileSync(file, 'utf-8')
        .split('\n')
        .forEach((line, index) => {
          if (/z\.string\(\)/.test(line) && !/\.(max|length|regex|email)\(|objectIdSchema|z\.email|z\.url/.test(line) && !/const (text|trimmed) =/.test(line)) {
            offenders.push(`${path.basename(file)}:${index + 1}: ${line.trim()}`);
          }
          if (/z\.array\(/.test(line) && !/\.max\(/.test(line)) offenders.push(`${path.basename(file)}:${index + 1}: ${line.trim()}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});

describe('operator injection and mass assignment', () => {
  function app() {
    const server = express();
    server.use(express.json());
    server.get('/q', validate({ query: searchToursQuery }), (req, res) => res.json(validated(req).query));
    server.post('/login', validate({ body: loginBody }), (req, res) => res.json(validated(req).body));
    server.use(errorHandler);
    return server;
  }

  it('Express 5 does not turn ?key[$ne]=x into an object, and the schema drops unknown keys', async () => {
    const res = await request(app()).get('/q?q[$ne]=a&categoryId[$gt]=&sort[$ne]=x');
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('$');
    expect(res.body).toMatchObject({ sort: 'newest', page: 1, limit: 20 });
  });

  it('rejects operator objects sent where a string is expected', async () => {
    const res = await request(app()).post('/login').send({ email: { $ne: '' }, password: { $ne: '' } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('bounds pagination and numeric filters', async () => {
    expect((await request(app()).get('/q?limit=101')).status).toBe(400);
    expect((await request(app()).get('/q?limit=0')).status).toBe(400);
    expect((await request(app()).get('/q?page=-1')).status).toBe(400);
    expect((await request(app()).get('/q?minPrice=10&maxPrice=5')).status).toBe(400);
    expect((await request(app()).get('/q?q=' + 'x'.repeat(101))).status).toBe(400);
  });

  it('registration cannot choose a staff role or smuggle privileged fields', () => {
    const base = { email: 'a@b.com', password: 'Passw0rd1', fullName: 'Ann Lee' };
    expect(registerBody.safeParse({ ...base, role: 'SUPER_ADMIN' }).success).toBe(false);
    expect(registerBody.safeParse({ ...base, role: 'MODERATOR' }).success).toBe(false);
    const parsed = registerBody.parse({ ...base, status: 'ACTIVE', permissions: ['audit:view'], extraPermissions: ['x'], emailVerifiedAt: 'now' });
    expect(Object.keys(parsed).sort()).toEqual(['email', 'fullName', 'password', 'role']);
    expect(parsed.role).toBe('TRAVELER');
  });

  it('profile and access bodies reject unknown fields outright (strict)', () => {
    expect(updateProfileBody.safeParse({ role: 'SUPER_ADMIN' }).success).toBe(false);
    expect(updateProfileBody.safeParse({ fullName: 'Ann Lee', status: 'ACTIVE' }).success).toBe(false);
    expect(assignAccessBody.safeParse({ role: 'MODERATOR', passwordHash: 'x' }).success).toBe(false);
    expect(assignAccessBody.safeParse({ extraPermissions: ['made:up'] }).success).toBe(false);
  });

  it('a booking request carries ids and head-count only: any price field is rejected', () => {
    const ok = { tourId: '507f1f77bcf86cd799439011', departureId: '507f1f77bcf86cd799439012', participants: 2, contact: { fullName: 'Ann Lee', phone: '0123456789' } };
    expect(createBookingBody.safeParse(ok).success).toBe(true);
    expect(createBookingBody.safeParse({ ...ok, totalAmount: 1 }).success).toBe(false);
    expect(createBookingBody.safeParse({ ...ok, unitPrice: 1 }).success).toBe(false);
    expect(createBookingBody.safeParse({ ...ok, status: 'CONFIRMED' }).success).toBe(false);
    expect(createBookingBody.safeParse({ ...ok, participants: 51 }).success).toBe(false);
  });
});

describe('text search is regex-safe', () => {
  it('escapes metacharacters so user text is matched literally', () => {
    expect(escapeRegex('a.b*c(d)[e]{f}|g\\h$^+?')).toBe('a\\.b\\*c\\(d\\)\\[e\\]\\{f\\}\\|g\\\\h\\$\\^\\+\\?');
    const pattern = containsRegex('(a+)+$');
    expect(pattern.test('xx(a+)+$yy')).toBe(true);
    expect(pattern.test('aaaaaaaaaaaaaaaaaaaaaaaa!')).toBe(false); // no catastrophic backtracking, no regex semantics
  });
});
