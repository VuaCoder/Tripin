/**
 * `pnpm --filter backend seed` — idempotent bootstrap data (first SUPER_ADMIN, categories, subscription plans, optional
 * commission). Configuration comes from the environment / root .env:
 *   SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD  (both needed to create the first SUPER_ADMIN; no default password exists)
 *   SEED_ADMIN_NAME                          (optional display name)
 *   SEED_COMMISSION_PERCENT                  (optional; applied only if no commission was ever saved)
 */
import { connectDatabase, disconnectDatabase } from '../config/database';
import { AUTH_POLICY, passwordSchema } from '../modules/auth';
import { categoriesRepository } from '../modules/categories';
import { subscriptionsRepository } from '../modules/subscriptions';
import { systemSettingsRepository } from '../modules/system-settings';
import { usersRepository } from '../modules/users';
import { seedDatabase } from './seed-logic';

function readCommission(): number | undefined {
  const raw = process.env.SEED_COMMISSION_PERCENT;
  return raw === undefined || raw.trim() === '' ? undefined : Number(raw);
}

async function main(): Promise<void> {
  await connectDatabase();
  try {
    await seedDatabase(
      {
        users: usersRepository,
        categories: categoriesRepository,
        plans: subscriptionsRepository,
        settings: systemSettingsRepository,
        checkPassword: (password) => {
          const result = passwordSchema.safeParse(password);
          return result.success ? null : result.error.issues.map((issue) => issue.message).join('; ');
        },
        bcryptRounds: AUTH_POLICY.BCRYPT_ROUNDS,
        log: (message) => console.log(`[seed] ${message}`),
      },
      {
        adminEmail: process.env.SEED_ADMIN_EMAIL,
        adminPassword: process.env.SEED_ADMIN_PASSWORD,
        adminName: process.env.SEED_ADMIN_NAME,
        commissionPercent: readCommission(),
      },
    );
  } finally {
    await disconnectDatabase();
  }
}

main().catch((error) => {
  console.error(`[seed] failed: ${(error as Error).message}`);
  process.exit(1);
});
