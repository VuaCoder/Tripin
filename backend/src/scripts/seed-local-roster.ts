import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase, prisma } from '../config/database';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url || new URL(url).hostname !== '127.0.0.1') throw new Error('This seed only accepts a local PostgreSQL URL');
  await connectDatabase(url);
  try {
    const owner = await prisma.user.findUnique({ where: { email: 'demo.coastal@tripri.local' }, include: { agencyProfile: true } });
    if (!owner?.agencyProfile) throw new Error('Run seed-demo-tours first');
    const tour = await prisma.tour.findFirst({
      where: { agencyId: owner.agencyProfile.id, status: 'APPROVED', departures: { some: { date: { gt: new Date() } } } },
      include: { departures: { where: { date: { gt: new Date() } }, orderBy: { date: 'asc' }, take: 1 } },
      orderBy: { title: 'asc' },
    });
    const departure = tour?.departures[0];
    if (!tour || !departure) throw new Error('No upcoming demo tour departure');
    const traveler = await prisma.user.upsert({
      where: { email: 'demo.traveler@tripri.local' },
      create: { email: 'demo.traveler@tripri.local', fullName: 'Nguyễn Minh Anh', role: 'TRAVELER', status: 'ACTIVE', emailVerifiedAt: new Date(), passwordHash: await bcrypt.hash('Tripri@123', 10) },
      update: { status: 'ACTIVE' },
    });
    const unitPrice = tour.basePrice;
    const totalAmount = unitPrice * 2n;
    const commissionAmount = totalAmount / 10n;
    const endDate = new Date(departure.date.getTime() + tour.durationDays * 86_400_000);
    const booking = await prisma.booking.upsert({
      where: { bookingCode: 'TRP-DEMO-ROSTER' },
      create: {
        bookingCode: 'TRP-DEMO-ROSTER', travelerId: traveler.id, agencyId: owner.agencyProfile.id,
        tourId: tour.id, departureId: departure.id, tourTitle: tour.title, departureDate: departure.date, endDate,
        participants: 2, contactName: 'Nguyễn Minh Anh', contactPhone: '0901234567',
        notes: 'Đoàn khách thử nghiệm để kiểm tra danh sách hành khách.',
        passengerSnapshot: [
          { fullName: 'Nguyễn Minh Anh', birthYear: 1992, ageGroup: 'ADULT', phone: '0901234567', pickupPoint: 'Nhà hát Lớn Hà Nội', specialNotes: 'Ăn chay' },
          { fullName: 'Trần Gia Bảo', birthYear: 2017, ageGroup: 'CHILD', phone: '0907654321', pickupPoint: 'Nhà hát Lớn Hà Nội', specialNotes: 'Dị ứng đậu phộng' },
        ],
        unitPrice, subtotal: totalAmount, totalAmount, commissionBps: 1000, commissionAmount,
        agencyAmount: totalAmount - commissionAmount, status: 'CONFIRMED', isPaid: true, confirmedAt: new Date(),
      },
      update: {},
    });
    console.log(`Roster booking ${booking.bookingCode}: ${tour.title}; departure ${departure.date.toISOString()}`);
    console.log(`Tour ${tour.id}; departure ${departure.id}; booking ${booking.id}`);
  } finally { await disconnectDatabase(); }
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
