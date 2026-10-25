/** Explicitly targeted dev catalog; never resets existing accounts, purchases or edited plans. */
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { disconnectDatabase, prisma } from '../config/database';
import { premiumRepository } from '../modules/premium/premium.repository';
import {
  contributionBody,
  planBody,
} from '../modules/premium/premium.validation';

const PREFIX = '[DEV Premium]';
const TOUR_ID = '70d4992d-4bcf-4698-8b6c-ffcb3849e610';
const SOURCE_ID = '70d4992d-4bcf-4698-8b6c-ffcb3849e611';
const ACCOUNTS = [
  {
    email: 'premium.demo.agency@tripri.test',
    role: 'AGENCY',
    name: `${PREFIX} Agency`,
  },
  {
    email: 'premium.demo.traveler@tripri.test',
    role: 'TRAVELER',
    name: `${PREFIX} Traveler`,
  },
  {
    email: 'premium.demo.guide@tripri.test',
    role: 'TOUR_GUIDE',
    name: `${PREFIX} Guide`,
  },
] as const;

async function main() {
  const expectedHost = process.argv
    .find((arg) => arg.startsWith('--expected-host='))
    ?.split('=')[1];
  const database = new URL(env.DATABASE_URL);
  const normalize = (host: string) => host.replace('-pooler.', '.');
  if (
    env.NODE_ENV !== 'development' ||
    !expectedHost ||
    normalize(database.hostname) !== normalize(expectedHost)
  ) {
    throw new Error(
      'Requires NODE_ENV=development and --expected-host matching the configured database.',
    );
  }
  const enableSales = process.argv.includes('--enable-sales');
  const credentialsFile = path.resolve(
    process.cwd(),
    'node_modules/.cache/premium-dev-credentials.json',
  );
  const saved = await readFile(credentialsFile, 'utf8')
    .then((value) => JSON.parse(value) as { password?: string; host?: string })
    .catch(() => null);
  if (saved?.host && saved.host !== normalize(database.hostname))
    throw new Error('Credential file belongs to a different dev database.');
  const password =
    process.env.PREMIUM_DEMO_PASSWORD ||
    saved?.password ||
    randomBytes(32).toString('base64url');
  if (password.length < 12)
    throw new Error('Demo password must contain at least 12 characters.');
  for (const account of ACCOUNTS) {
    const previous = await prisma.user.findUnique({
      where: { email: account.email },
    });
    if (
      previous &&
      (previous.role !== account.role ||
        !previous.fullName.startsWith(PREFIX) ||
        previous.status !== 'ACTIVE' ||
        !previous.passwordHash ||
        !(await bcrypt.compare(password, previous.passwordHash)))
    ) {
      throw new Error(
        `Existing demo identity/password differs for ${account.email}; no credentials were overwritten.`,
      );
    }
  }
  await mkdir(path.dirname(credentialsFile), { recursive: true });
  // Persist before creating accounts so an interrupted seed can resume without resetting passwords.
  await writeFile(
    credentialsFile,
    JSON.stringify(
      {
        host: normalize(database.hostname),
        password,
        accounts: ACCOUNTS.map((a) => ({ email: a.email, role: a.role })),
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  const passwordHash = await bcrypt.hash(password, 12);
  const users = [];
  for (const account of ACCOUNTS) {
    const previous = await prisma.user.findUnique({
      where: { email: account.email },
    });
    if (
      previous &&
      (previous.role !== account.role ||
        !previous.fullName.startsWith(PREFIX) ||
        previous.status !== 'ACTIVE')
    ) {
      throw new Error(
        `Reserved demo account collision: ${account.email}; existing account was not modified.`,
      );
    }
    if (
      previous &&
      (!previous.passwordHash ||
        !(await bcrypt.compare(password, previous.passwordHash)))
    ) {
      throw new Error(
        `Existing password differs for ${account.email}; no password was reset. Supply the original PREMIUM_DEMO_PASSWORD.`,
      );
    }
    users.push(
      previous ??
        (await prisma.user.create({
          data: {
            email: account.email,
            fullName: account.name,
            role: account.role,
            status: 'ACTIVE',
            emailVerifiedAt: new Date(),
            passwordHash,
            ...(account.role === 'AGENCY'
              ? {
                  agencyProfile: {
                    create: {
                      companyName: `${PREFIX} Travel`,
                      description:
                        'Agency mẫu dành riêng cho kiểm thử Premium dev.',
                      verificationStatus: 'VERIFIED',
                      verifiedAt: new Date(),
                    },
                  },
                }
              : {}),
            ...(account.role === 'TOUR_GUIDE'
              ? {
                  guideProfile: {
                    create: {
                      bio: 'Hồ sơ hướng dẫn viên mẫu cho Premium dev.',
                      languages: ['Tiếng Việt', 'English'],
                      specialties: ['Văn hóa', 'Ẩm thực'],
                      experienceYears: 3,
                    },
                  },
                }
              : {}),
          },
        })),
    );
  }
  const agency = users[0]!;
  const category = await prisma.category.upsert({
    where: { slug: 'dev-premium-demo' },
    create: {
      slug: 'dev-premium-demo',
      name: `${PREFIX} Trải nghiệm`,
      isActive: true,
    },
    update: {},
  });
  const previousTour = await prisma.tour.findUnique({ where: { id: TOUR_ID } });
  if (
    previousTour &&
    (previousTour.agencyId !== agency.id ||
      !previousTour.title.startsWith(PREFIX))
  )
    throw new Error('Demo tour ID collision; no existing tour was modified.');
  await prisma.tour.upsert({
    where: { id: TOUR_ID },
    create: {
      id: TOUR_ID,
      agencyId: agency.id,
      title: `${PREFIX} Khám phá Đà Nẵng – Hội An`,
      summary: 'Tour mẫu để thử voucher Premium trên môi trường dev.',
      description:
        'Dữ liệu kiểm thử. Không phải sản phẩm du lịch mở bán thực tế.',
      destination: 'Đà Nẵng',
      durationDays: 2,
      basePrice: 1_200_000,
      maxGroupSize: 20,
      status: 'APPROVED',
      reviewedAt: new Date(),
      inclusions: ['Hướng dẫn viên', 'Di chuyển trong chương trình'],
      exclusions: ['Chi phí cá nhân'],
      itinerary: [
        {
          day: 1,
          title: 'Khám phá Đà Nẵng',
          activities: ['Tham quan thành phố'],
        },
        {
          day: 2,
          title: 'Trải nghiệm Hội An',
          activities: ['Tham quan phố cổ'],
        },
      ],
      categories: { connect: { id: category.id } },
      departures: {
        create: [7, 21, 45].map((days) => ({
          date: new Date(Date.now() + days * 86_400_000),
          capacity: 20,
          remaining: 20,
        })),
      },
    },
    update: {},
  });
  const bookable = await prisma.tourDeparture.count({
    where: {
      tourId: TOUR_ID,
      isOpen: true,
      date: { gt: new Date() },
      remaining: { gt: 0 },
    },
  });
  if (!bookable)
    await prisma.tourDeparture.create({
      data: {
        tourId: TOUR_ID,
        date: new Date(Date.now() + 14 * 86_400_000),
        capacity: 20,
        remaining: 20,
      },
    });

  const { acceptedTerms: _acceptedTerms, ...contribution } =
    contributionBody.parse({
      acceptedTerms: true,
      title: `${PREFIX} Giảm 10% tour trải nghiệm`,
      tourIds: [TOUR_ID],
      discountType: 'PERCENT',
      discountValue: 10,
      maxDiscountAmount: 100_000,
      minOrderAmount: 500_000,
      capacity: 5_000,
    });
  const source = await prisma.premiumContribution.upsert({
    where: { id: SOURCE_ID },
    create: { id: SOURCE_ID, agencyId: agency.id, ...contribution },
    update: {},
  });
  if (source.agencyId !== agency.id || !source.title.startsWith(PREFIX))
    throw new Error('Demo contribution ID collision.');
  if (source.status === 'PENDING')
    await premiumRepository.decideContribution(source.id, 'APPROVED');
  else if (source.status !== 'APPROVED' || !source.acceptingNew)
    throw new Error(
      'Demo contribution was rejected/stopped; its configuration was preserved.',
    );

  const definitions = [
    {
      code: 'DEV_PREMIUM_TRAVELER_30_V1',
      audience: 'TRAVELER',
      days: 30,
      price: 49_000,
      quantity: 2,
    },
    {
      code: 'DEV_PREMIUM_TRAVELER_90_V1',
      audience: 'TRAVELER',
      days: 90,
      price: 129_000,
      quantity: 6,
    },
    {
      code: 'DEV_PREMIUM_GUIDE_30_V1',
      audience: 'TOUR_GUIDE',
      days: 30,
      price: 99_000,
      quantity: 0,
    },
    {
      code: 'DEV_PREMIUM_GUIDE_90_V1',
      audience: 'TOUR_GUIDE',
      days: 90,
      price: 249_000,
      quantity: 0,
    },
  ] as const;
  const plans = [];
  for (const definition of definitions) {
    const input = planBody.parse({
      code: definition.code,
      name: `${PREFIX} ${definition.audience === 'TRAVELER' ? 'Traveler' : 'Guide'} ${definition.days} ngày`,
      description:
        'Gói mẫu cho môi trường dev. Giá minh họa; thanh toán sử dụng PayOS đang được cấu hình.',
      audience: definition.audience,
      price: definition.price,
      durationDays: definition.days,
      version: 1,
      benefits:
        definition.audience === 'TRAVELER'
          ? [
              `${definition.quantity} voucher theo kỳ`,
              'Giảm 10%, tối đa 100.000đ/voucher',
              'Áp dụng tour demo, đơn từ 500.000đ',
            ]
          : [
              'Portfolio và chứng chỉ bổ sung',
              'Khung avatar vàng và huy hiệu Premium',
              'Ưu tiên hiển thị trước Agency',
              'Thống kê thu nhập và lịch sử hoạt động nâng cao',
            ],
      vouchers: definition.quantity
        ? [{ contributionId: SOURCE_ID, quantity: definition.quantity }]
        : [],
    });
    const previous = await prisma.subscriptionPlan.findUnique({
      where: { code: input.code },
    });
    if (
      previous &&
      (!previous.isPremium ||
        previous.audience !== input.audience ||
        !previous.name.startsWith(PREFIX))
    )
      throw new Error(`Reserved plan code collision: ${input.code}`);
    const plan = previous ?? (await premiumRepository.createPlan(input));
    plans.push(
      enableSales ? await premiumRepository.publishPlan(plan.id, true) : plan,
    );
  }
  if (enableSales)
    await prisma.$transaction(
      ['TRAVELER', 'TOUR_GUIDE'].map((audience) =>
        prisma.systemSetting.upsert({
          where: { key: `premium.enabled.${audience}` },
          create: { key: `premium.enabled.${audience}`, value: true },
          update: { value: true },
        }),
      ),
    );
  console.log(
    JSON.stringify(
      {
        host: normalize(database.hostname),
        database: database.pathname.slice(1),
        salesEnabled: enableSales,
        plans: plans.map((p) => ({
          id: p.id,
          code: p.code,
          price: p.price,
          durationDays: p.durationDays,
          published: p.published,
        })),
        accounts: ACCOUNTS.map((a) => ({ email: a.email, role: a.role })),
        credentialsFile,
        tourId: TOUR_ID,
        contributionId: SOURCE_ID,
      },
      null,
      2,
    ),
  );
}
main()
  .catch((error) => {
    console.error(
      `[premium-dev] ${error instanceof Error ? error.message : 'Seed failed'}`,
    );
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
