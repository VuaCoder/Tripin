import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { AUTH_POLICY, passwordSchema } from '../../modules/auth';
import { categoriesRepository } from '../../modules/categories';
import { subscriptionsRepository } from '../../modules/subscriptions';
import { systemSettingsRepository } from '../../modules/system-settings';
import { usersRepository } from '../../modules/users';
import { bearer, resetDatabase, startDatabase, stopDatabase } from '../../test/integration';
import { DEFAULT_CATEGORIES, DEFAULT_PLANS, seedDatabase, type SeedOptions } from '../seed-logic';
import { prisma } from '../../config/database';

// Real MongoDB + the real repositories: what `pnpm --filter backend seed` does to an empty and to an existing database.
const app = createApp();

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);

const logs: string[] = [];
const run = (options: SeedOptions) =>
  seedDatabase(
    {
      users: usersRepository,
      categories: categoriesRepository,
      plans: subscriptionsRepository,
      settings: systemSettingsRepository,
      checkPassword: (password) => {
        const result = passwordSchema.safeParse(password);
        return result.success ? null : result.error.issues.map((issue) => issue.message).join('; ');
      },
      bcryptRounds: 4, // the production value is irrelevant to what is being checked and slow
      log: (message) => logs.push(message),
    },
    options,
  );

const ADMIN = { adminEmail: 'Owner@Example.com', adminPassword: 'Str0ngSeedPass', adminName: 'The Owner' };

describe('seed script (integration)', () => {
  it('bootstraps an empty database: a working Super admin, categories, plans and the commission', async () => {
    const report = await run({ ...ADMIN, commissionPercent: 7.5 });
    expect(report).toEqual({ adminCreated: true, categoriesCreated: DEFAULT_CATEGORIES.length, plansCreated: DEFAULT_PLANS.length, commissionSet: true });

    // The seeded admin can really log in and use admin endpoints (email normalised to lower case).
    const login = await request(app).post('/api/v1/auth/login').send({ email: 'owner@example.com', password: ADMIN.adminPassword });
    expect(login.status).toBe(200);
    expect(login.body.data.user.role).toBe('SUPER_ADMIN');
    const token = login.body.data.accessToken as string;
    expect((await request(app).get('/api/v1/admin/users').set(bearer(token))).status).toBe(200);
    expect((await request(app).get('/api/v1/admin/settings/commission').set(bearer(token))).body.data.ratePercent).toBe(7.5);

    // Public pages work straight away.
    expect((await request(app).get('/api/v1/categories')).body.data).toHaveLength(DEFAULT_CATEGORIES.length);
    expect((await request(app).get('/api/v1/subscriptions/plans')).body.data.map((p: { code: string }) => p.code)).toEqual(['GUIDE_MONTHLY', 'GUIDE_YEARLY']);
  });

  it('is idempotent and never overwrites what the owner changed afterwards', async () => {
    await run({ ...ADMIN, commissionPercent: 10 });

    await prisma.category.updateMany({ where: { slug: 'adventure' }, data: { name: 'Adventure!', description: 'Edited by the owner' } });
    await prisma.subscriptionPlan.updateMany({ where: { code: 'GUIDE_MONTHLY' }, data: { price: 249_000 } });
    await prisma.user.updateMany({ where: { email: 'owner@example.com' }, data: { fullName: 'Renamed Owner', role: 'MODERATOR' } });

    const again = await run({ ...ADMIN, adminPassword: 'AnotherPass123', commissionPercent: 99 });
    expect(again).toEqual({ adminCreated: false, categoriesCreated: 0, plansCreated: 0, commissionSet: false });

    expect(await prisma.category.count()).toBe(DEFAULT_CATEGORIES.length);
    expect((await prisma.category.findFirst({ where: { slug: 'adventure' } }))!.description).toBe('Edited by the owner');
    expect((await prisma.subscriptionPlan.findFirst({ where: { code: 'GUIDE_MONTHLY' } }))!.price).toBe(249_000);
    const owner = (await prisma.user.findFirst({ where: { email: 'owner@example.com' } }))!;
    expect(owner.fullName).toBe('Renamed Owner');
    expect(owner.role).toBe('MODERATOR'); // a re-run never re-promotes or re-passwords an existing account
    expect(await prisma.user.count()).toBe(1);
    expect((await systemSettingsRepository.findByKey('commission'))!.value).toEqual({ rateBps: 1000 });
  });

  it('refuses unsafe input without writing a partial result', async () => {
    await expect(run({ adminEmail: 'owner@example.com', adminPassword: 'short' })).rejects.toThrow(/SEED_ADMIN_PASSWORD rejected/);
    await expect(run({ commissionPercent: 150 })).rejects.toThrow(/between 0 and 100/);
    await expect(run({ commissionPercent: Number.NaN })).rejects.toThrow(/between 0 and 100/);
    expect(await prisma.user.count()).toBe(0);
  });

  it('without admin credentials it still seeds the reference data and creates no account', async () => {
    const report = await run({});
    expect(report.adminCreated).toBe(false);
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.category.count()).toBe(DEFAULT_CATEGORIES.length);
    expect(AUTH_POLICY.BCRYPT_ROUNDS).toBeGreaterThanOrEqual(10); // production hashing cost is not the test's cheaper value
  });
});
