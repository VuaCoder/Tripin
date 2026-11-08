import { prisma, disconnectDatabase } from '../config/database';
import { encryptPayoutAccount } from '../modules/users/payout-account.crypto';
import { updateProfileBody } from '../modules/users/users.validation';

/** Run after the schema migration, with the production keyring configured. Safe to rerun. */
export async function backfillGuidePayoutAccounts(): Promise<number> {
  const users = await prisma.user.findMany({ where: { role: 'TOUR_GUIDE' }, select: { id: true, preferences: true } });
  let migrated = 0;
  for (const user of users) {
    if (!user.preferences || typeof user.preferences !== 'object' || !('bankAccount' in user.preferences)) continue;
    await prisma.$transaction(async (tx) => {
      // Re-read under the user row lock so profile changes cannot restore stale plaintext.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id}::uuid FOR UPDATE`;
      const current = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      const legacy = (current.preferences as { bankAccount?: unknown } | null)?.bankAccount;
      const existing = await tx.guidePayoutAccount.findUnique({ where: { guideId: user.id } });
      if (legacy && !existing) {
        const parsed = updateProfileBody.parse({ bankAccount: legacy });
        await tx.guidePayoutAccount.create({ data: { guideId: user.id, ...encryptPayoutAccount(user.id, parsed.bankAccount!) } });
      }
      await tx.$executeRaw`UPDATE "User" SET "preferences" = "preferences" - 'bankAccount' WHERE "id" = ${user.id}::uuid`;
    });
    migrated += 1;
  }
  return migrated;
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/backfill-guide-payout-accounts.ts')) {
  backfillGuidePayoutAccounts().then((count) => console.log(`Migrated ${count} guide payout accounts`))
    .catch(() => { console.error('Payout backfill failed; no sensitive data logged. Check keyring and legacy account validation.'); process.exitCode = 1; })
    .finally(disconnectDatabase);
}
