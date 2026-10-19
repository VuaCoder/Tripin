/** Disposable local fixtures only. See docs/testing/guide-finance/README.md. */
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { prisma } from '../config/database';

const PASSWORD = 'GuideFinance!2026';
const EMAILS = [
  'guide.finance.a@tripri.test',
  'guide.finance.b@tripri.test',
  'guide.finance.traveler@tripri.test',
  'guide.finance.agency@tripri.test',
];
const CODES = [
  'DEV_GUIDE_FINANCE_30',
  'DEV_GUIDE_FINANCE_90',
  'DEV_GUIDE_FINANCE_RETIRED',
];
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000);

function requireDisposableLocalDatabase() {
  const url = new URL(env.DATABASE_URL);
  if (
    env.NODE_ENV === 'production' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !url.pathname.startsWith('/tripri_guide_finance')
  ) {
    throw new Error(
      'Use a disposable LOOPBACK database named tripri_guide_finance*. Shared/remote databases are refused.',
    );
  }
}

async function clean() {
  const users = await prisma.user.findMany({
    where: { email: { in: EMAILS } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  await prisma.$transaction([
    prisma.earning.deleteMany({ where: { guideId: { in: userIds } } }),
    prisma.payment.deleteMany({
      where: { userId: { in: userIds }, purpose: 'SUBSCRIPTION' },
    }),
    prisma.subscription.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.subscriptionPlan.deleteMany({ where: { code: { in: CODES } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ]);
}

async function create() {
  await clean();
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const users = [];
  for (const [index, role] of (
    ['TOUR_GUIDE', 'TOUR_GUIDE', 'TRAVELER', 'AGENCY'] as const
  ).entries()) {
    users.push(
      await prisma.user.create({
        data: {
          email: EMAILS[index]!,
          fullName: [
            'Guide A · Có dữ liệu',
            'Guide B · Chưa có dữ liệu',
            'Traveler kiểm tra quyền',
            'Agency kiểm tra quyền',
          ][index]!,
          role,
          passwordHash,
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
        },
      }),
    );
  }
  const guide = users[0]!;
  const agency = users[3]!;
  const monthly = await prisma.subscriptionPlan.create({
    data: {
      code: CODES[0]!,
      name: 'Guide Monthly (dev)',
      price: 199_000,
      durationDays: 30,
      benefits: ['Hỗ trợ ưu tiên'],
      sortOrder: 1,
    },
  });
  await prisma.subscriptionPlan.create({
    data: {
      code: CODES[1]!,
      name: 'Guide Quarterly (dev)',
      price: 499_000,
      durationDays: 90,
      benefits: ['Hỗ trợ ưu tiên', 'Thời hạn 90 ngày'],
      sortOrder: 2,
    },
  });
  const retired = await prisma.subscriptionPlan.create({
    data: {
      code: CODES[2]!,
      name: 'Gói ngừng bán (dev)',
      price: 99_000,
      durationDays: 30,
      isActive: false,
    },
  });
  const createSubscription = (
    status: 'ACTIVE' | 'PENDING_PAYMENT' | 'EXPIRED' | 'CANCELLED',
    startsAt?: Date,
    endsAt?: Date,
    plan = monthly,
  ) =>
    prisma.subscription.create({
      data: {
        userId: guide.id,
        planId: plan.id,
        planCode: plan.code,
        planName: plan.name,
        price: plan.price,
        durationDays: plan.durationDays,
        status,
        startsAt,
        endsAt,
      },
    });
  const running = await createSubscription('ACTIVE', day(-5), day(25));
  const future = await createSubscription('ACTIVE', day(25), day(55));
  const pending = await createSubscription('PENDING_PAYMENT');
  await createSubscription('PENDING_PAYMENT', undefined, undefined, retired);
  await createSubscription('EXPIRED', day(-60), day(-30));
  await createSubscription('CANCELLED');
  let orderCode = BigInt(Date.now());
  const payment = (
    referenceId: string,
    status: 'PAID' | 'PENDING' | 'FAILED',
  ) =>
    prisma.payment.create({
      data: {
        userId: guide.id,
        purpose: 'SUBSCRIPTION',
        referenceId,
        status,
        amount: monthly.price,
        description: monthly.code,
        provider: 'PAYOS',
        providerOrderCode: orderCode++,
        expiresAt: day(1),
        ...(status === 'PAID'
          ? { paidAt: new Date(), fulfilledAt: new Date() }
          : {}),
      },
    });
  const paid = await payment(future.id, 'PAID');
  const waiting = await payment(pending.id, 'PENDING');
  const failed = await payment(pending.id, 'FAILED');
  await prisma.earning.createMany({
    data: Array.from({ length: 12 }, (_, index) => ({
      guideId: guide.id,
      bookingId: randomUUID(),
      bookingCode: `DEV-FIN-${index + 1}`,
      tourId: randomUUID(),
      tourTitle: index % 2 ? 'Đà Nẵng – Hội An (dev)' : 'Hạ Long (dev)',
      agencyId: agency.id,
      amount: (index + 1) * 50_000,
      earnedAt: new Date(Date.UTC(2026, index < 6 ? 8 : 9, index + 1, 12)),
    })),
  });
  console.log(
    JSON.stringify(
      {
        accounts: EMAILS,
        password: PASSWORD,
        runningSubscriptionId: running.id,
        paidPaymentId: paid.id,
        pendingPaymentId: waiting.id,
        failedPaymentId: failed.id,
      },
      null,
      2,
    ),
  );
}

async function main() {
  requireDisposableLocalDatabase();
  if (process.argv[2] === 'create') await create();
  else if (process.argv[2] === 'clean') await clean();
  else
    throw new Error(
      'Usage: pnpm exec tsx src/scripts/dev-guide-finance-fixture.ts <create|clean>',
    );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
