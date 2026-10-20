/**
 * DEV-ONLY fixture for the Tour-guide Profile & Assigned-Tours end-to-end run
 * (not part of the product; delete after use).
 *
 *   npx tsx src/scripts/dev-guide-fixture.ts create
 *   npx tsx src/scripts/dev-guide-fixture.ts clean
 *
 * `create` writes: a VERIFIED agency owning four APPROVED tours, two TOUR_GUIDE accounts
 * (one with assignments in every state, one with none for the empty state) and a TRAVELER
 * used to prove the role guard. `clean` removes exactly those rows again.
 *
 * Run against a throwaway local database, never the shared Neon branch. The password is never
 * committed — export DEV_GUIDE_PASSWORD (same variable the Playwright driver reads):
 *   DATABASE_URL="postgresql://postgres@127.0.0.1:5433/tripri_guide_e2e" DEV_GUIDE_PASSWORD=... \
 *     npx tsx src/scripts/dev-guide-fixture.ts create
 */
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';

const PASSWORD = process.env.DEV_GUIDE_PASSWORD;
if (!PASSWORD) throw new Error('DEV_GUIDE_PASSWORD is required; this fixture ships no password');
const AGENCY_EMAIL = 'dev.guide.agency@tripri.test';
const GUIDE_EMAIL = 'dev.guide@tripri.test';
const FOREIGN_GUIDE_EMAIL = 'dev.guide.foreign@tripri.test';
const NO_TOURS_GUIDE_EMAIL = 'dev.guide.none@tripri.test';
const TRAVELER_EMAIL = 'dev.guide.traveler@tripri.test';

/** Every fixture tour title starts with this marker so `clean` can find them. */
const MARKER = '[DEV-GUIDE]';
const TOUR_TITLES = {
  pending: `${MARKER} Hạ Long 2N1Đ`,
  accepted: `${MARKER} Đà Nẵng – Hội An 3N2Đ`,
  declined: `${MARKER} Phú Quốc 4N3Đ`,
  foreign: `${MARKER} Sapa 3N2Đ`,
};

const FIXTURE_EMAILS = [AGENCY_EMAIL, GUIDE_EMAIL, FOREIGN_GUIDE_EMAIL, NO_TOURS_GUIDE_EMAIL, TRAVELER_EMAIL];

const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

async function clean() {
  const tours = await prisma.tour.findMany({ where: { title: { startsWith: MARKER } }, select: { id: true } });
  const tourIds = tours.map((tour) => tour.id);

  const assignments = await prisma.tourGuideAssignment.deleteMany({ where: { tourId: { in: tourIds } } });
  const departures = await prisma.tourDeparture.deleteMany({ where: { tourId: { in: tourIds } } });
  const removedTours = await prisma.tour.deleteMany({ where: { id: { in: tourIds } } });
  const users = await prisma.user.deleteMany({ where: { email: { in: FIXTURE_EMAILS } } });

  return {
    assignments: assignments.count,
    departures: departures.count,
    tours: removedTours.count,
    users: users.count,
  };
}

const account = async (email: string, fullName: string, role: 'AGENCY' | 'TOUR_GUIDE' | 'TRAVELER') =>
  prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(PASSWORD, 12),
      fullName,
      phone: '0900000000',
      role,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
    select: { id: true },
  });

async function create() {
  await clean(); // idempotent: never stack fixtures

  const category =
    (await prisma.category.findFirst({ where: { isActive: true }, select: { id: true } })) ??
    (await prisma.category.create({
      data: { name: 'Văn hóa & Phố thị', slug: `dev-guide-culture-${Date.now()}` },
      select: { id: true },
    }));

  const agency = await account(AGENCY_EMAIL, 'Dev Guide Agency', 'AGENCY');
  await prisma.agencyProfile.create({
    data: {
      userId: agency.id,
      companyName: 'Dev Guide Travel',
      description: 'Đại lý dữ liệu dev cho bài test hướng dẫn viên.',
      address: 'Hà Nội',
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date(),
    },
  });

  // The main guide starts with a half-filled profile so one screen shows both a value and "Chưa cập nhật".
  const guide = await account(GUIDE_EMAIL, 'Nguyễn Văn Hướng Dẫn', 'TOUR_GUIDE');
  await prisma.guideProfile.create({
    data: {
      userId: guide.id,
      bio: 'Hướng dẫn viên miền Bắc, yêu thích trekking và văn hóa bản địa.',
      languages: ['Tiếng Việt'],
      specialties: [],
    },
  });

  // Owns the Sapa tour, so it is the account that proves a guide cannot answer someone else's assignment.
  const foreignGuide = await account(FOREIGN_GUIDE_EMAIL, 'Trần Thị Hướng Dẫn Khác', 'TOUR_GUIDE');
  await prisma.guideProfile.create({ data: { userId: foreignGuide.id, languages: [], specialties: [] } });

  // No assignment at all: the empty state.
  const noToursGuide = await account(NO_TOURS_GUIDE_EMAIL, 'Lê Văn Chưa Có Tour', 'TOUR_GUIDE');
  await prisma.guideProfile.create({ data: { userId: noToursGuide.id, languages: [], specialties: [] } });

  await account(TRAVELER_EMAIL, 'Dev Guide Traveler', 'TRAVELER');

  const tour = (title: string, destination: string, durationDays: number, basePrice: number, departureInDays: number) =>
    prisma.tour.create({
      data: {
        agencyId: agency.id,
        title,
        summary: 'Tour dữ liệu dev cho bài test hướng dẫn viên.',
        description: 'Dữ liệu tạo tự động cho bài test end-to-end của tính năng Tour Guide Profile & Assigned Tours.',
        destination,
        durationDays,
        basePrice,
        maxGroupSize: 20,
        status: 'APPROVED',
        submittedAt: new Date(),
        reviewedAt: new Date(),
        categories: { connect: { id: category.id } },
        departures: {
          create: [
            { date: daysFromNow(departureInDays), capacity: 20, remaining: 14 },
            { date: daysFromNow(departureInDays + 14), capacity: 20, remaining: 20 },
          ],
        },
      },
      select: { id: true },
    });

  const pending = await tour(TOUR_TITLES.pending, 'Quảng Ninh', 2, 2_400_000, 30);
  const accepted = await tour(TOUR_TITLES.accepted, 'Đà Nẵng', 3, 3_500_000, 45);
  const declined = await tour(TOUR_TITLES.declined, 'Kiên Giang', 4, 6_200_000, 60);
  const foreign = await tour(TOUR_TITLES.foreign, 'Lào Cai', 3, 2_900_000, 21);

  await prisma.tourGuideAssignment.create({
    data: { tourId: pending.id, guideId: guide.id, feePerBooking: 500_000, status: 'PENDING' },
  });
  await prisma.tourGuideAssignment.create({
    data: {
      tourId: accepted.id,
      guideId: guide.id,
      feePerBooking: 750_000,
      status: 'ACCEPTED',
      respondedAt: new Date(),
      note: 'Đã sắp xếp lịch.',
    },
  });
  await prisma.tourGuideAssignment.create({
    data: {
      tourId: declined.id,
      guideId: guide.id,
      feePerBooking: 900_000,
      status: 'DECLINED',
      respondedAt: new Date(),
      note: 'Trùng lịch dẫn tour khác.',
    },
  });
  // Assigned to the OTHER guide: used to prove a guide cannot answer a tour outside their scope.
  await prisma.tourGuideAssignment.create({
    data: { tourId: foreign.id, guideId: foreignGuide.id, feePerBooking: 400_000, status: 'PENDING' },
  });

  return {
    accounts: { agency: AGENCY_EMAIL, guide: GUIDE_EMAIL, foreignGuide: FOREIGN_GUIDE_EMAIL, noToursGuide: NO_TOURS_GUIDE_EMAIL, traveler: TRAVELER_EMAIL, password: PASSWORD },
    tourIds: { pending: pending.id, accepted: accepted.id, declined: declined.id, foreign: foreign.id },
  };
}

const action = process.argv[2];
const run = action === 'create' ? create : action === 'clean' ? clean : null;
if (!run) throw new Error('usage: npx tsx src/scripts/dev-guide-fixture.ts <create|clean>');

run()
  .then((result) => console.log(action, JSON.stringify(result, null, 2)))
  .finally(() => prisma.$disconnect());
