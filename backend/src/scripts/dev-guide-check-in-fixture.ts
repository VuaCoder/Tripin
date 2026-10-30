/**
 * DEV-ONLY fixture for the Tour-guide QR check-in end-to-end run.
 *
 *   npx tsx src/scripts/dev-guide-fixture.ts create   # accounts + accepted tour
 *   npx tsx src/scripts/dev-guide-check-in-fixture.ts create
 *   npx tsx src/scripts/dev-guide-check-in-fixture.ts clean
 *
 * `create` adds bookings and e-tickets to the guide fixture's accepted tour, plus a second
 * ACCEPTED tour used to prove a ticket from another tour is refused. Codes are deterministic so
 * the Playwright driver can scan them without reading this script's stdout. Never run against the
 * shared Neon branch: point DATABASE_URL at a throwaway local database.
 */
import { prisma } from '../config/database';

const MARKER = 'DEVCHK-';
const SECOND_TOUR = '[DEV-CHECKIN] Hà Nội – Ninh Bình 2N1Đ';
const ACCEPTED_TOUR = '[DEV-GUIDE] Đà Nẵng – Hội An 3N2Đ';
const GUIDE_EMAIL = 'dev.guide@tripri.test';
const TRAVELER_EMAIL = 'dev.guide.traveler@tripri.test';
const AGENCY_EMAIL = 'dev.guide.agency@tripri.test';

const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
const codeFor = (n: number) => `ETK-DEVCHK${String(n).padStart(10, '0')}`;
const bookingCodeFor = (n: number) => `${MARKER}${String(n).padStart(4, '0')}`;

async function clean() {
  const tickets = await prisma.eTicket.deleteMany({ where: { bookingCode: { startsWith: MARKER } } });
  const bookings = await prisma.booking.deleteMany({ where: { bookingCode: { startsWith: MARKER } } });
  const tours = await prisma.tour.deleteMany({ where: { title: { startsWith: '[DEV-CHECKIN]' } } });
  return { tickets: tickets.count, bookings: bookings.count, tours: tours.count };
}

async function create() {
  await clean();

  const [agency, guide, traveler] = await Promise.all([
    prisma.user.findUnique({ where: { email: AGENCY_EMAIL }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: GUIDE_EMAIL }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: TRAVELER_EMAIL }, select: { id: true } }),
  ]);
  if (!agency || !guide || !traveler) {
    throw new Error('Run dev-guide-fixture.ts create first (agency, guide and traveler are missing)');
  }

  const accepted = await prisma.tour.findFirst({
    where: { title: ACCEPTED_TOUR },
    select: { id: true, title: true, departures: { orderBy: { date: 'asc' }, take: 1, select: { id: true, date: true } } },
  });
  if (!accepted?.departures[0]) throw new Error('The accepted guide tour has no departure');

  const other = await prisma.tour.create({
    data: {
      agencyId: agency.id,
      title: SECOND_TOUR,
      summary: 'Tour thứ hai của cùng hướng dẫn viên, dùng để thử vé sai tour.',
      destination: 'Ninh Bình',
      durationDays: 2,
      basePrice: 1_800_000,
      maxGroupSize: 20,
      status: 'APPROVED',
      submittedAt: new Date(),
      reviewedAt: new Date(),
      departures: { create: [{ date: daysFromNow(50), capacity: 20, remaining: 18 }] },
      guideAssignment: { create: { guideId: guide.id, feePerBooking: 400_000, status: 'ACCEPTED', respondedAt: new Date() } },
    },
    select: { id: true, title: true, departures: { select: { id: true, date: true } } },
  });

  type TicketSpec = {
    n: number;
    tour: { id: string; title: string };
    departure: { id: string; date: Date };
    holderName: string;
    participants: number;
    status?: 'VALID' | 'USED' | 'CANCELLED';
    usedAt?: Date;
    cancelledAt?: Date;
  };

  const makeTicket = async (spec: TicketSpec) => {
    const unitPrice = 1_000_000;
    const subtotal = unitPrice * spec.participants;
    const commissionBps = 1000;
    const commissionAmount = Math.round((subtotal * commissionBps) / 10_000);
    const bookingCode = bookingCodeFor(spec.n);
    const status = spec.status ?? 'VALID';

    const booking = await prisma.booking.create({
      data: {
        bookingCode,
        travelerId: traveler.id,
        agencyId: agency.id,
        tourId: spec.tour.id,
        departureId: spec.departure.id,
        tourTitle: spec.tour.title,
        departureDate: spec.departure.date,
        endDate: new Date(spec.departure.date.getTime() + 3 * 24 * 60 * 60 * 1000),
        participants: spec.participants,
        contactName: spec.holderName,
        contactPhone: '0900000000',
        unitPrice,
        subtotal,
        totalAmount: subtotal,
        commissionBps,
        commissionAmount,
        agencyAmount: subtotal - commissionAmount,
        status: status === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED',
        isPaid: status !== 'CANCELLED',
        confirmedAt: status === 'CANCELLED' ? null : new Date(),
        cancelledAt: spec.cancelledAt ?? null,
      },
      select: { id: true },
    });

    const ticket = await prisma.eTicket.create({
      data: {
        bookingId: booking.id,
        bookingCode,
        code: codeFor(spec.n),
        travelerId: traveler.id,
        agencyId: agency.id,
        tourId: spec.tour.id,
        tourTitle: spec.tour.title,
        departureDate: spec.departure.date,
        participants: spec.participants,
        holderName: spec.holderName,
        status,
        issuedAt: new Date(),
        usedAt: spec.usedAt ?? null,
        cancelledAt: spec.cancelledAt ?? null,
      },
      select: { id: true, code: true },
    });

    return { ...ticket, bookingId: booking.id, holderName: spec.holderName, participants: spec.participants, status };
  };

  const first = accepted.departures[0];
  const second = other.departures[0];
  if (!second) throw new Error('The second tour has no departure');

  const tickets = {
    valid: await makeTicket({ n: 1, tour: accepted, departure: first, holderName: 'Nguyễn Văn An', participants: 2 }),
    duplicate: await makeTicket({ n: 2, tour: accepted, departure: first, holderName: 'Trần Thị Bình', participants: 1 }),
    wrongTour: await makeTicket({ n: 3, tour: other, departure: second, holderName: 'Lê Văn Cường', participants: 1 }),
    cancelled: await makeTicket({
      n: 4,
      tour: accepted,
      departure: first,
      holderName: 'Phạm Thị Dung',
      participants: 3,
      status: 'CANCELLED',
      cancelledAt: new Date(),
    }),
    used: await makeTicket({
      n: 5,
      tour: accepted,
      departure: first,
      holderName: 'Hoàng Văn Em',
      participants: 2,
      status: 'USED',
      usedAt: new Date(Date.now() - 60 * 60 * 1000),
    }),
  };

  return { acceptedTourId: accepted.id, otherTourId: other.id, tickets };
}

const action = process.argv[2];
const run = action === 'create' ? create : action === 'clean' ? clean : null;
if (!run) throw new Error('usage: npx tsx src/scripts/dev-guide-check-in-fixture.ts <create|clean>');

run()
  .then((result) => console.log(action, JSON.stringify(result, null, 2)))
  .finally(() => prisma.$disconnect());
