/** Targeted, additive voucher wallet fixtures for the requested Traveler01 account. */
import { prisma, disconnectDatabase } from '../config/database';
import { env } from '../config/env';
import { premiumRepository } from '../modules/premium/premium.repository';

const EMAIL = 'traveler01@tripri.test';
const SUBSCRIPTION_ID = '70d4992d-4bcf-4698-8b6c-ffcb3849e612';
const DAY = 86_400_000;

async function main() {
  if (env.NODE_ENV !== 'development') throw new Error('Development environment required.');
  const host = new URL(env.DATABASE_URL).hostname;
  const expectedHost = process.argv.find(arg => arg.startsWith('--expected-host='))?.slice('--expected-host='.length);
  if (expectedHost !== host) throw new Error('Pass --expected-host matching the configured development database.');
  const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
  if (user.role !== 'TRAVELER' || user.status !== 'ACTIVE') throw new Error('Expected the active Traveler01 account.');
  if (process.argv.includes('--apply')) {
    const now = new Date();
    const endsAt = new Date(now.getTime() + 30 * DAY);
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id}::uuid FOR UPDATE`;
      const existing = await tx.subscription.findUnique({ where: { id: SUBSCRIPTION_ID } });
      if (existing && existing.userId !== user.id) throw new Error('Fixture subscription ID collision.');
      if (existing && (existing.status !== 'ACTIVE' || existing.revokedAt || !existing.endsAt || existing.endsAt <= now)) {
        throw new Error('Existing fixture period is no longer active; its history was preserved.');
      }
      if (!existing) {
        const plan = await tx.subscriptionPlan.findUniqueOrThrow({
          where: { code: 'DEV_PREMIUM_TRAVELER_30_V1' },
          include: { premiumVouchers: { include: { contribution: true } } },
        });
        if (!plan.isPremium || plan.audience !== 'TRAVELER' || !plan.premiumVouchers.length) throw new Error('Missing the Traveler Premium dev plan.');
        await tx.subscription.create({ data: {
          id: SUBSCRIPTION_ID, userId: user.id, planId: plan.id, planCode: plan.code,
          planName: plan.name, price: 0n, durationDays: 30, isPremium: true,
          audience: 'TRAVELER', planVersion: plan.version, status: 'ACTIVE', startsAt: now, endsAt,
          entitlementSnapshot: { benefits: plan.benefits, guide: false, devFixture: 'traveler01-voucher-wallet' },
        } });
        for (const item of plan.premiumVouchers) {
          const c = item.contribution;
          const reserved = await tx.$executeRaw`UPDATE "PremiumContribution" SET reserved = reserved + ${item.quantity} WHERE id = ${c.id}::uuid AND status = 'APPROVED' AND "acceptingNew" = true AND reserved + ${item.quantity} <= capacity`;
          if (!reserved) throw new Error('Premium voucher capacity unavailable.');
          await tx.premiumReservation.create({ data: {
            subscriptionId: SUBSCRIPTION_ID, contributionId: c.id, quantity: item.quantity,
            state: 'COMMITTED', expiresAt: endsAt,
            terms: { title: c.title, agencyId: c.agencyId, tourIds: c.tourIds, discountType: c.discountType,
              discountValue: c.discountValue, maxDiscountAmount: c.maxDiscountAmount, minOrderAmount: c.minOrderAmount },
          } });
        }
      }
      const admin = await tx.user.findFirstOrThrow({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE' } });
      for (const item of [
        { code: 'TRV01-WALLET-100K', title: '[TEST Traveler01] Ưu đãi du lịch 100K', discountType: 'FIXED' as const, discountValue: 100_000n, maxDiscountAmount: null },
        { code: 'TRV01-WALLET-10PCT', title: '[TEST Traveler01] Ưu đãi du lịch 10%', discountType: 'PERCENT' as const, discountValue: 10n, maxDiscountAmount: 200_000n },
      ]) {
        const previous = await tx.promotion.findUnique({ where: { code: item.code } });
        if (previous && previous.title !== item.title) throw new Error('Fixture voucher code collision.');
        const promo = previous ?? await tx.promotion.create({ data: {
          ...item, scope: 'PLATFORM', applyType: 'COLLECTABLE', codeType: 'SHARED', createdById: admin.id,
          minOrderAmount: 500_000n, startsAt: now, endsAt, usageLimit: 1, usageLimitPerUser: 1,
          description: 'Voucher mẫu để kiểm tra ví voucher Traveler01 trong development.',
        } });
        await tx.userVoucher.upsert({
          where: { userId_promotionId: { userId: user.id, promotionId: promo.id } },
          create: { userId: user.id, promotionId: promo.id }, update: {},
        });
      }
    }, { timeout: 30_000 });
    await premiumRepository.grantDue(now, user.id);
  }
  const status = await premiumRepository.status(user.id);
  const premiumVouchers = await premiumRepository.vouchers(user.id);
  console.log(JSON.stringify({ host, account: user.email, premium: { active: status.active, endsAt: status.endsAt },
    premiumVouchers: premiumVouchers.map(v => ({ id: v.id, terms: v.terms, startsAt: v.startsAt, endsAt: v.endsAt, bookingId: v.bookingId })),
    normalVoucherCount: await prisma.userVoucher.count({ where: { userId: user.id } }),
  }, null, 2));
  if (process.argv.includes('--apply') && (!status.active || premiumVouchers.length < 2)) throw new Error('Premium fixture verification failed.');
}
void main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(disconnectDatabase);
