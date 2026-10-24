import bcrypt from 'bcryptjs';
import { ROLES, USER_STATUS } from '@travel-platform/constants';
import { slugify } from '../utils/slug';

/** Tour categories created on first run (the Super admin edits them afterwards). */
export const DEFAULT_CATEGORIES = [
  { name: 'Beach & Islands', description: 'Biển, đảo và các kỳ nghỉ ven biển thư giãn', sortOrder: 10 },
  { name: 'Mountains & Trekking', description: 'Cao nguyên, cung đường leo núi và trekking hùng vĩ', sortOrder: 20 },
  { name: 'City & Culture', description: 'Thành phố, di sản lịch sử và văn hóa bản địa', sortOrder: 30 },
  { name: 'Food & Cuisine', description: 'Trải nghiệm tinh hoa ẩm thực và đặc sản vùng miền', sortOrder: 40 },
  { name: 'Adventure', description: 'Hoạt động dã ngoại, thể thao cảm giác mạnh và mạo hiểm', sortOrder: 50 },
  { name: 'Eco & Nature', description: 'Vườn quốc gia, khám phá thiên nhiên và du lịch sinh thái', sortOrder: 60 },
  { name: 'Resort & Wellness', description: 'Nghỉ dưỡng resort, khoáng nóng Onsen, spa và chăm sóc sức khỏe', sortOrder: 70 },
  { name: 'Cruises & Waterways', description: 'Du thuyền cao cấp vịnh biển, du ngoạn sông nước miệt vườn', sortOrder: 80 },
  { name: 'Spiritual & Pilgrimage', description: 'Chiêm bái đền chùa, thánh địa tâm linh và hành hương', sortOrder: 90 },
  { name: 'Family Friendly', description: 'Hành trình nhẹ nhàng, tiện ích phù hợp cho gia đình có trẻ em và người lớn tuổi', sortOrder: 100 },
  { name: 'Day Tour', description: 'Tour khám phá ngắn trong ngày, city tour linh hoạt', sortOrder: 110 },
  { name: 'Photography & Cloud Hunting', description: 'Điểm check-in săn mây, ngắm bình minh hoàng hôn và chụp ảnh phong cảnh', sortOrder: 120 },
  { name: 'Camping & Glamping', description: 'Cắm trại ngoài trời, lều trại cao cấp glamping giữa thiên nhiên', sortOrder: 130 },
  { name: 'Festivals & Events', description: 'Lễ hội truyền thống, festival âm nhạc và sự kiện đặc sắc', sortOrder: 140 },
  { name: 'Craft & Agritourism', description: 'Trải nghiệm làng nghề thủ công truyền thống và nông trại miệt vườn', sortOrder: 150 },
  { name: 'Luxury & Private', description: 'Tour cao cấp, dịch vụ tiêu chuẩn 5 sao và lịch trình riêng tư', sortOrder: 160 },
  { name: 'MICE & Corporate', description: 'Du lịch kết hợp hội nghị, hội thảo, teambuilding doanh nghiệp', sortOrder: 170 },
  { name: 'Honeymoon & Romantic', description: 'Kỳ nghỉ lãng mạn dành riêng cho các cặp đôi và tuần trăng mật', sortOrder: 180 },
  { name: 'Motorbike & Road Trip', description: 'Chinh phục các cung đèo hiểm trở bằng xe máy hoặc tự lái', sortOrder: 190 },
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
