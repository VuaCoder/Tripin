import bcrypt from 'bcryptjs';
import { ROLES, USER_STATUS } from '@travel-platform/constants';
import { slugify } from '../utils/slug';

/** Tour categories created on first run (the Super admin edits them afterwards). */
export const DEFAULT_CATEGORIES = [
  { name: 'Beach & Islands', description: 'Sea, islands and coastal escapes', sortOrder: 10 },
  { name: 'Mountains & Trekking', description: 'Highlands, hiking and scenic routes', sortOrder: 20 },
  { name: 'City & Culture', description: 'Cities, heritage sites and local culture', sortOrder: 30 },
  { name: 'Food & Cuisine', description: 'Culinary and street-food experiences', sortOrder: 40 },
  { name: 'Adventure', description: 'Active and outdoor experiences', sortOrder: 50 },
  { name: 'Eco & Nature', description: 'National parks, nature and sustainable travel', sortOrder: 60 },
] as const;

/**
 * Illustrative plans so the subscription flow can be tried end to end. The prices are NOT business decisions
 * (DECISIONS D-44): the owner replaces them directly in the database before going live.
 */
export const DEFAULT_PLANS = [
  { code: 'GUIDE_MONTHLY', name: 'Guide Monthly', description: 'One month of guide subscription', price: 199_000, durationDays: 30, sortOrder: 10, benefits: [] },
  { code: 'GUIDE_YEARLY', name: 'Guide Yearly', description: 'One year of guide subscription', price: 1_990_000, durationDays: 365, sortOrder: 20, benefits: [] },
] as const;

export interface SeedDeps {
  users: {
    findByEmail(email: string): Promise<{ id: string; role: string } | null>;
    create(data: Record<string, unknown>): Promise<unknown>;
  };
  categories: {
    findBySlug(slug: string): Promise<unknown | null>;
    create(data: Record<string, unknown>): Promise<unknown>;
  };
  plans: { createPlanIfAbsent(code: string, data: Record<string, unknown>): Promise<boolean> };
  settings: {
    findByKey(key: string): Promise<unknown | null>;
    upsert(key: string, value: unknown, updatedBy?: string): Promise<unknown>;
  };
  /** Validates the admin password with the same policy as registration; returns an error message or null. */
  checkPassword(password: string): string | null;
  bcryptRounds: number;
  log(message: string): void;
}

export interface SeedOptions {
  adminEmail?: string;
  adminPassword?: string;
  adminName?: string;
  /** Initial platform commission in percent; only applied when no value has ever been saved. */
  commissionPercent?: number;
}

export interface SeedReport {
  adminCreated: boolean;
  categoriesCreated: number;
  plansCreated: number;
  commissionSet: boolean;
}

/** Idempotent: running it twice changes nothing the second time, and it never overwrites data edited by the owner. */
export async function seedDatabase(deps: SeedDeps, options: SeedOptions): Promise<SeedReport> {
  const report: SeedReport = { adminCreated: false, categoriesCreated: 0, plansCreated: 0, commissionSet: false };

  // ---- first SUPER_ADMIN (staff cannot self-register, DECISIONS D-4). No default password exists anywhere.
  if (options.adminEmail && options.adminPassword) {
    const email = options.adminEmail.trim().toLowerCase();
    const problem = deps.checkPassword(options.adminPassword);
    if (problem) throw new Error(`SEED_ADMIN_PASSWORD rejected: ${problem}`);

    const existing = await deps.users.findByEmail(email);
    if (existing) {
      deps.log(`Admin ${email} already exists (role ${existing.role}) - left untouched`);
    } else {
      await deps.users.create({
        email,
        passwordHash: await bcrypt.hash(options.adminPassword, deps.bcryptRounds),
        fullName: options.adminName?.trim() || 'Super Admin',
        role: ROLES.SUPER_ADMIN,
        status: USER_STATUS.ACTIVE,
        emailVerifiedAt: new Date(),
      });
      report.adminCreated = true;
      deps.log(`Created SUPER_ADMIN ${email}`);
    }
  } else {
    deps.log('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set - no SUPER_ADMIN created');
  }

  // ---- categories
  for (const category of DEFAULT_CATEGORIES) {
    const slug = slugify(category.name);
    if (await deps.categories.findBySlug(slug)) continue;
    await deps.categories.create({ ...category, slug });
    report.categoriesCreated += 1;
  }

  // ---- subscription plans (never overwritten)
  for (const plan of DEFAULT_PLANS) {
    if (await deps.plans.createPlanIfAbsent(plan.code, { ...plan, benefits: [...plan.benefits] })) report.plansCreated += 1;
  }

  // ---- commission: only an explicit choice, and only if the owner has not saved one yet
  if (options.commissionPercent !== undefined) {
    if (!Number.isFinite(options.commissionPercent) || options.commissionPercent < 0 || options.commissionPercent > 100) {
      throw new Error('SEED_COMMISSION_PERCENT must be between 0 and 100');
    }
    if (!(await deps.settings.findByKey('commission'))) {
      await deps.settings.upsert('commission', { rateBps: Math.round(options.commissionPercent * 100) });
      report.commissionSet = true;
    }
  }

  deps.log(
    `Seed done: admin ${report.adminCreated ? 'created' : 'unchanged'}, ${report.categoriesCreated} categories, ${report.plansCreated} plans, commission ${report.commissionSet ? 'set' : 'unchanged'}`,
  );
  return report;
}
