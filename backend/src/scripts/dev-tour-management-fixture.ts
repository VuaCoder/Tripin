/** Development data for the agency tour management manual test plan.
 * From repo root: npm.cmd --prefix backend run fixture:tour-ux:create
 * Clean:          npm.cmd --prefix backend run fixture:tour-ux:clean
 */
import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase, prisma } from '../config/database';

const prefix = '[TEST-TOUR-UX]';
const bookingPrefix = 'TESTTOURUX-';
const defaultPassword = 'TripriTourTest@2026!';
const accounts = [
  { email: 'test.tour.owner@tripri.local', name: 'Test Tour Owner', role: 'OWNER' },
  { email: 'test.tour.manager@tripri.local', name: 'Test Tour Manager', role: 'MANAGER' },
  { email: 'test.tour.staff@tripri.local', name: 'Test Tour Staff', role: 'STAFF' },
  { email: 'test.tour.accountant@tripri.local', name: 'Test Tour Accountant', role: 'ACCOUNTANT' },
] as const;
const travelerEmail = 'test.tour.traveler@tripri.local';
const daysFromNow = (days: number) => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
};

async function clean() {
  const tours = await prisma.tour.findMany({ where: { title: { startsWith: prefix } }, select: { id: true } });
  const tourIds = tours.map(({ id }) => id);
  await prisma.booking.deleteMany({ where: { bookingCode: { startsWith: bookingPrefix }, tourId: { in: tourIds } } });
  await prisma.tour.deleteMany({ where: { id: { in: tourIds } } });
  const users = await prisma.user.findMany({ where: { email: { in: [...accounts.map((a) => a.email), travelerEmail] } }, select: { id: true } });
  const userIds = users.map(({ id }) => id);
  await prisma.agencyMember.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.agencyProfile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  return { tours: tourIds.length, users: userIds.length };
}

async function create() {
  const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Tour' AND column_name = 'highlights'
  `;
  if (!columns.length) throw new Error('Database is missing Tour.highlights. Apply the pending schema migration in a compatible test database before creating this fixture.');
  const password = process.env.DEV_TOUR_TEST_PASSWORD || defaultPassword;
  if (password.length < 8) throw new Error('DEV_TOUR_TEST_PASSWORD must have at least 8 characters.');
  const existing = await prisma.user.count({ where: { email: { in: [...accounts.map((a) => a.email), travelerEmail] } } });
  if (existing || await prisma.tour.count({ where: { title: { startsWith: prefix } } })) {
    throw new Error('Fixture already exists. Run clean first; create never overwrites existing test data.');
  }
  const hash = await bcrypt.hash(password, 10);
  const owner = await prisma.user.create({ data: { email: accounts[0].email, fullName: accounts[0].name, passwordHash: hash, role: 'AGENCY', status: 'ACTIVE', emailVerifiedAt: new Date() } });
  const agency = await prisma.agencyProfile.create({ data: { userId: owner.id, companyName: 'Tour UX Test Agency', address: 'Hà Nội', verificationStatus: 'VERIFIED', verifiedAt: new Date() } });
  for (const account of accounts.slice(1)) {
    const user = await prisma.user.create({ data: { email: account.email, fullName: account.name, passwordHash: hash, role: 'AGENCY', status: 'ACTIVE', emailVerifiedAt: new Date() } });
    await prisma.agencyMember.create({ data: { agencyId: agency.id, userId: user.id, role: account.role } });
  }
  const traveler = await prisma.user.create({ data: { email: travelerEmail, fullName: 'Test Tour Traveler', passwordHash: hash, role: 'TRAVELER', status: 'ACTIVE', emailVerifiedAt: new Date() } });
  const category = await prisma.category.findFirst({ where: { isActive: true }, select: { id: true } });
  const specs = [
    { key: 'DRAFT', status: 'DRAFT', departures: [{ offset: 30, capacity: 20, remaining: 20, open: true }] },
    { key: 'PENDING_REVIEW', status: 'PENDING_REVIEW', departures: [{ offset: 35, capacity: 20, remaining: 20, open: true }] },
    { key: 'APPROVED', status: 'APPROVED', departures: [{ offset: 40, capacity: 20, remaining: 20, open: true }] },
    { key: 'ARCHIVED', status: 'ARCHIVED', departures: [{ offset: 45, capacity: 20, remaining: 20, open: false }] },
    { key: 'BOOKED', status: 'APPROVED', departures: [{ offset: 50, capacity: 20, remaining: 18, open: true }] },
    { key: 'NO_OPEN_DEPARTURE', status: 'DRAFT', departures: [{ offset: 55, capacity: 20, remaining: 20, open: false }] },
  ] as const;
  const results: { scenario: string; tourId: string; url: string }[] = [];
  for (const spec of specs) {
    const tour = await prisma.tour.create({
      data: {
        agencyId: agency.id, title: `${prefix} ${spec.key} - Hà Nội 3 ngày`, summary: `Dữ liệu kiểm thử ${spec.key}.`,
        description: 'Tour mẫu để kiểm tra xem chi tiết, sửa nội dung và phân quyền.', destination: 'Hà Nội',
        durationDays: 3, basePrice: 2_000_000, maxGroupSize: 20, status: spec.status,
        submittedAt: spec.status === 'DRAFT' ? null : new Date(),
        reviewedAt: spec.status === 'APPROVED' || spec.status === 'ARCHIVED' ? new Date() : null,
        itinerary: [
          { day: 1, title: 'Phố cổ Hà Nội', description: 'Tham quan khu phố cổ.', activities: ['Hồ Hoàn Kiếm'] },
          { day: 2, title: 'Văn Miếu', description: 'Tìm hiểu lịch sử.', activities: ['Văn Miếu Quốc Tử Giám'] },
        ],
        inclusions: ['Xe đưa đón'], exclusions: ['Chi phí cá nhân'], highlights: ['Văn hóa Hà Nội'],
        cancellationPolicy: 'Hoàn tiền theo điều kiện tour.', travelNotes: 'Mang giày đi bộ.',
        ...(category ? { categories: { connect: { id: category.id } } } : {}),
        departures: { create: spec.departures.map((d) => ({ date: daysFromNow(d.offset), capacity: d.capacity, remaining: d.remaining, priceOverride: 2_200_000, isOpen: d.open })) },
      },
      include: { departures: true },
    });
    if (spec.key === 'BOOKED') {
      const departure = tour.departures[0]!;
      await prisma.booking.create({ data: {
        bookingCode: `${bookingPrefix}001`, travelerId: traveler.id, agencyId: agency.id,
        tourId: tour.id, departureId: departure.id, tourTitle: tour.title,
        departureDate: departure.date, endDate: daysFromNow(53), participants: 2,
        contactName: traveler.fullName, contactPhone: '0900000000', unitPrice: 2_200_000,
        subtotal: 4_400_000, totalAmount: 4_400_000, commissionBps: 1000,
        commissionAmount: 440_000, agencyAmount: 3_960_000, status: 'CONFIRMED', isPaid: true,
      } });
    }
    results.push({ scenario: spec.key, tourId: tour.id, url: `/agency/tours/${tour.id}` });
  }
  return { accounts: [...accounts.map((a) => ({ role: a.role, email: a.email })), { role: 'TRAVELER', email: travelerEmail }], tours: results };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required.');
  const isLocal = ['127.0.0.1', 'localhost'].includes(new URL(url).hostname);
  if (!isLocal && process.env.DEV_TOUR_TEST_ALLOW_REMOTE !== '1') {
    throw new Error('Remote database requires DEV_TOUR_TEST_ALLOW_REMOTE=1.');
  }
  await connectDatabase(url);
  try {
    if (process.argv[2] === 'create') console.log(JSON.stringify(await create(), null, 2));
    else if (process.argv[2] === 'clean') console.log(JSON.stringify(await clean(), null, 2));
    else throw new Error('Usage: dev-tour-management-fixture.ts create|clean');
  } finally { await disconnectDatabase(); }
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
