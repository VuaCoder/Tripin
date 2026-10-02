import bcrypt from 'bcryptjs';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_CATEGORIES, DEFAULT_PLANS, seedDatabase, type SeedDeps } from '../seed-logic';

type D = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function makeDeps(state: { users?: D[]; slugs?: string[]; plans?: string[]; settings?: Record<string, unknown> } = {}) {
  const users = [...(state.users ?? [])];
  const slugs = new Set(state.slugs ?? []);
  const plans = new Set(state.plans ?? []);
  const settings = { ...(state.settings ?? {}) };
  const deps = {
    users: {
      findByEmail: vi.fn(async (email: string): Promise<{ id: string; role: string } | null> => (users.find((u) => u.email === email) as { id: string; role: string } | undefined) ?? null),
      create: vi.fn(async (data: D) => {
        users.push({ id: `u${users.length + 1}`, ...data });
      }),
    },
    categories: {
      findBySlug: vi.fn(async (slug: string) => (slugs.has(slug) ? {} : null)),
      create: vi.fn(async (data: D) => {
        slugs.add(data.slug);
      }),
    },
    plans: {
      createPlanIfAbsent: vi.fn(async (code: string) => {
        if (plans.has(code)) return false;
        plans.add(code);
        return true;
      }),
    },
    settings: {
      findByKey: vi.fn(async (key: string) => settings[key] ?? null),
      upsert: vi.fn(async (key: string, value: unknown) => {
        settings[key] = value;
      }),
    },
    checkPassword: vi.fn((password: string) => (password.length >= 8 ? null : 'too short')),
    bcryptRounds: 4,
    log: vi.fn(),
  } satisfies SeedDeps;
  return { deps, users, slugs, plans, settings };
}

const admin = { adminEmail: ' Admin@Tripri.test ', adminPassword: 'Str0ngPassw0rd', adminName: 'Boss' };

describe('seedDatabase', () => {
  it('creates the first SUPER_ADMIN with a hashed password, lower-cased email and verified ACTIVE status', async () => {
    const { deps, users } = makeDeps();
    const report = await seedDatabase(deps, admin);
    expect(report.adminCreated).toBe(true);
    expect(users[0]).toMatchObject({ email: 'admin@tripri.test', role: 'SUPER_ADMIN', status: 'ACTIVE', fullName: 'Boss' });
    expect(users[0]!.passwordHash).not.toContain('Str0ngPassw0rd');
    expect(await bcrypt.compare('Str0ngPassw0rd', users[0]!.passwordHash)).toBe(true);
    expect(users[0]!.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it('creates no admin (and invents no password) when the credentials are not provided', async () => {
    const { deps, users } = makeDeps();
    expect((await seedDatabase(deps, {})).adminCreated).toBe(false);
    expect((await seedDatabase(deps, { adminEmail: 'a@b.com' })).adminCreated).toBe(false);
    expect(users).toHaveLength(0);
  });

  it('rejects a weak admin password before touching the database', async () => {
    const { deps } = makeDeps();
    await expect(seedDatabase(deps, { adminEmail: 'a@b.com', adminPassword: 'short' })).rejects.toThrow(/rejected/);
    expect(deps.users.create).not.toHaveBeenCalled();
    expect(deps.categories.create).not.toHaveBeenCalled();
  });

  it('never modifies an existing account with that email (no silent promotion or password reset)', async () => {
    const { deps, users } = makeDeps({ users: [{ id: 'u1', email: 'admin@tripri.test', role: 'TRAVELER' }] });
    const report = await seedDatabase(deps, admin);
    expect(report.adminCreated).toBe(false);
    expect(deps.users.create).not.toHaveBeenCalled();
    expect(users[0]!.role).toBe('TRAVELER');
  });

  it('seeds categories and plans once; a second run changes nothing', async () => {
    const { deps } = makeDeps();
    const first = await seedDatabase(deps, {});
    expect(first).toMatchObject({ categoriesCreated: DEFAULT_CATEGORIES.length, plansCreated: DEFAULT_PLANS.length });
    const second = await seedDatabase(deps, {});
    expect(second).toMatchObject({ categoriesCreated: 0, plansCreated: 0, adminCreated: false });
  });

  it('keeps categories and plans the owner already has', async () => {
    const { deps } = makeDeps({ slugs: ['beach-islands'], plans: ['GUIDE_MONTHLY'] });
    const report = await seedDatabase(deps, {});
    expect(report.categoriesCreated).toBe(DEFAULT_CATEGORIES.length - 1);
    expect(report.plansCreated).toBe(DEFAULT_PLANS.length - 1);
  });

  it('leaves the commission untouched unless explicitly requested, and never overwrites a saved one', async () => {
    const none = makeDeps();
    await seedDatabase(none.deps, {});
    expect(none.deps.settings.upsert).not.toHaveBeenCalled();

    const set = makeDeps();
    expect((await seedDatabase(set.deps, { commissionPercent: 12.5 })).commissionSet).toBe(true);
    expect(set.settings.commission).toEqual({ rateBps: 1250 });

    const saved = makeDeps({ settings: { commission: { rateBps: 500 } } });
    expect((await seedDatabase(saved.deps, { commissionPercent: 20 })).commissionSet).toBe(false);
    expect(saved.settings.commission).toEqual({ rateBps: 500 });
  });

  it('rejects an out-of-range commission', async () => {
    await expect(seedDatabase(makeDeps().deps, { commissionPercent: 101 })).rejects.toThrow(/between 0 and 100/);
    await expect(seedDatabase(makeDeps().deps, { commissionPercent: Number.NaN })).rejects.toThrow();
  });
});
