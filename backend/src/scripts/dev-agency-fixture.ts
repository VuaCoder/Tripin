/**
 * DEV-ONLY fixture for the Agency "Upload Promotions" and "Handle Tour Complaints" UI run
 * (not part of the product; delete after use).
 *
 *   Set DATABASE_URL and DEV_FIXTURE_PASSWORD in your ignored root .env, then:
 *   npx tsx src/scripts/dev-agency-fixture.ts create
 *   DATABASE_URL=... npx tsx src/scripts/dev-agency-fixture.ts clean
 *
 * Refuses to run against anything but a local database. Creates two VERIFIED agencies (the second one proves that
 * an agency cannot see or answer another agency's data), travelers, tours, promotions and complaints in every state.
 * Every account uses DEV_FIXTURE_PASSWORD. Passwords are never printed.
 */
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { assertDevScriptEnvironment, assertLocalDatabaseUrl, requireDevPassword } from './dev-script-config';

const AGENCY_EMAIL = 'dev.agency@tripri.test';
const OTHER_AGENCY_EMAIL = 'dev.agency.other@tripri.test';
const TRAVELER_EMAILS = [1, 2, 3, 4].map((n) => `dev.agency.traveler${n}@tripri.test`);
const FIXTURE_EMAILS = [AGENCY_EMAIL, OTHER_AGENCY_EMAIL, ...TRAVELER_EMAILS];
const MARKER = '[DEV-AGENCY]';
const PROMO_PREFIX = 'DEVAG';

const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

async function clean() {
  const users = await prisma.user.findMany({ where: { email: { in: FIXTURE_EMAILS } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  const tours = await prisma.tour.findMany({ where: { title: { startsWith: MARKER } }, select: { id: true } });
  const tourIds = tours.map((t) => t.id);
  await prisma.report.deleteMany({ where: { OR: [{ reporterId: { in: userIds } }, { agencyId: { in: userIds } }] } });
  await prisma.promotion.deleteMany({ where: { code: { startsWith: PROMO_PREFIX } } });
  await prisma.tourDeparture.deleteMany({ where: { tourId: { in: tourIds } } });
  await prisma.tour.deleteMany({ where: { id: { in: tourIds } } });
  await prisma.user.deleteMany({ where: { email: { in: FIXTURE_EMAILS } } });
}

const account = async (email: string, fullName: string, role: 'AGENCY' | 'TRAVELER', password: string) =>
  prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 12),
      fullName,
      phone: '0900000000',
      role,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
    select: { id: true },
  });

async function create(password: string) {
  await clean();

  const category =
    (await prisma.category.findFirst({ where: { isActive: true }, select: { id: true } })) ??
    (await prisma.category.create({ data: { name: 'Văn hóa & Phố thị', slug: `dev-agency-culture-${Date.now()}` }, select: { id: true } }));

  const agency = await account(AGENCY_EMAIL, 'Dev Agency', 'AGENCY', password);
  const other = await account(OTHER_AGENCY_EMAIL, 'Dev Agency Other', 'AGENCY', password);
  for (const [id, name] of [[agency.id, 'Dev Agency Travel'], [other.id, 'Dev Other Travel']] as const) {
    await prisma.agencyProfile.create({
      data: { userId: id, companyName: name, address: 'Hà Nội', verificationStatus: 'VERIFIED', verifiedAt: new Date() },
    });
  }
  const travelers = await Promise.all(TRAVELER_EMAILS.map((email, i) => account(email, `Nguyễn Văn Khách ${i + 1}`, 'TRAVELER', password)));

  const tour = (agencyId: string, title: string, destination: string) =>
    prisma.tour.create({
      data: {
        agencyId,
        title: `${MARKER} ${title}`,
        summary: 'Tour dữ liệu dev.',
        destination,
        durationDays: 2,
        basePrice: 2_400_000,
        maxGroupSize: 20,
        status: 'APPROVED',
        submittedAt: new Date(),
        reviewedAt: new Date(),
        categories: { connect: { id: category.id } },
        departures: { create: [{ date: daysFromNow(30), capacity: 20, remaining: 20 }] },
      },
      select: { id: true },
    });
  const tourA1 = await tour(agency.id, 'Hạ Long 2N1Đ', 'Quảng Ninh');
  const tourA2 = await tour(agency.id, 'Đà Nẵng 2N1Đ', 'Đà Nẵng');
  const tourB = await tour(other.id, 'Sapa 2N1Đ', 'Lào Cai');

  const promo = (ownerId: string, code: string, title: string, extra: Record<string, unknown> = {}) =>
    prisma.promotion.create({
      data: {
        scope: 'AGENCY',
        ownerId,
        code: `${PROMO_PREFIX}${code}`,
        title,
        discountType: 'PERCENT',
        discountValue: 10,
        startsAt: daysFromNow(-1),
        endsAt: daysFromNow(60),
        createdById: ownerId,
        ...extra,
      },
    });
  await promo(agency.id, 'RUN', 'Giảm 10% đang chạy', { maxDiscountAmount: 200_000, usedCount: 3, usageLimit: 100 });
  await promo(agency.id, 'OFF', 'Khuyến mãi đã tắt', { isActive: false });
  await promo(agency.id, 'SOON', 'Khuyến mãi sắp diễn ra', { startsAt: daysFromNow(10), endsAt: daysFromNow(40) });
  await promo(other.id, 'OTHER', 'Khuyến mãi của agency khác');

  const report = (reporterId: string, tourId: string, agencyId: string, category: string, description: string, extra: Record<string, unknown> = {}) =>
    prisma.report.create({
      data: {
        reporterId,
        targetType: 'TOUR',
        targetId: tourId,
        tourId,
        agencyId,
        category: category as never,
        description,
        ...extra,
      },
    });
  const open = (reporterId: string, tourId: string) => `${reporterId}:TOUR:${tourId}`;
  await report(travelers[0]!.id, tourA1.id, agency.id, 'SERVICE_QUALITY', 'Hướng dẫn viên đến muộn 45 phút và không xin lỗi khách.', { openKey: open(travelers[0]!.id, tourA1.id) });
  await report(travelers[1]!.id, tourA2.id, agency.id, 'MISLEADING_INFO', 'Khách sạn thực tế khác hoàn toàn so với ảnh quảng cáo trên trang tour.', { openKey: open(travelers[1]!.id, tourA2.id) });
  await report(travelers[2]!.id, tourA1.id, agency.id, 'PAYMENT_OR_REFUND', 'Tôi bị trừ tiền hai lần cho cùng một đơn đặt tour.', {
    status: 'AGENCY_RESPONDED',
    openKey: open(travelers[2]!.id, tourA1.id),
    agencyResponseText: 'Chúng tôi đã kiểm tra và sẽ hoàn lại khoản thanh toán trùng trong 3 ngày làm việc.',
    agencyResponseAt: new Date(),
    agencyResponseById: agency.id,
  });
  await report(travelers[3]!.id, tourA2.id, agency.id, 'SAFETY', 'Xe đưa đón chạy quá tốc độ trên đường đèo.', {
    status: 'RESOLVED',
    agencyResponseText: 'Chúng tôi đã nhắc nhở tài xế.',
    agencyResponseAt: new Date(),
    agencyResponseById: agency.id,
    resolutionDecision: 'RESOLVED',
    resolutionNote: 'Khiếu nại được chấp nhận, đại lý đã cam kết khắc phục.',
    resolvedAt: new Date(),
  });
  // Belongs to the OTHER agency: must never show up for dev.agency.
  await report(travelers[0]!.id, tourB.id, other.id, 'OTHER', 'Khiếu nại về tour của agency khác, agency này không được thấy.', { openKey: open(travelers[0]!.id, tourB.id) });

  return { agency: AGENCY_EMAIL, otherAgency: OTHER_AGENCY_EMAIL };
}

async function main() {
  assertDevScriptEnvironment();
  assertLocalDatabaseUrl(process.env.DATABASE_URL);
  const command = process.argv[2];
  if (command === 'create') console.log(JSON.stringify(await create(requireDevPassword('DEV_FIXTURE_PASSWORD')), null, 2));
  else if (command === 'clean') await clean();
  else throw new Error('usage: dev-agency-fixture.ts create|clean');
}

main()
  .catch(() => {
    // Database errors can contain connection URLs; do not print raw errors.
    console.error('Dev fixture failed. Check local database access, DEV_FIXTURE_PASSWORD and migrations.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
