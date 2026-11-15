/** Disposable local data for docs/testing/moderator/README.md. */
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';

const marker = '[QA-MOD]';
const password = process.env.DEV_MODERATOR_PASSWORD;
const url = process.env.DATABASE_URL ?? '';
if (!url) throw new Error('Set DATABASE_URL to a disposable local PostgreSQL database.');
if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('This fixture only accepts a local DATABASE_URL; the current URL points to a remote database.');
if (!password || password.length < 8) throw new Error('Set DEV_MODERATOR_PASSWORD (at least 8 characters).');

async function main() {
  const emails = ['moderator', 'agency', 'agency2', 'traveler', 'violator'].map((name) => `qa.mod.${name}@tripri.test`);
  if (await prisma.user.count({ where: { email: { in: emails } } })) throw new Error('QA moderator accounts already exist. Use a fresh disposable database.');
  const hash = await bcrypt.hash(password!, 10);
  const user = async (email: string, fullName: string, role: 'MODERATOR' | 'AGENCY' | 'TRAVELER') =>
    prisma.user.create({ data: { email, fullName, role, passwordHash: hash, status: 'ACTIVE', emailVerifiedAt: new Date() } });
  const [moderator, agencyOwner, agencyOwner2, traveler, violator] = await Promise.all([
    user(emails[0]!, 'QA Moderator', 'MODERATOR'), user(emails[1]!, 'QA Agency Owner', 'AGENCY'),
    user(emails[2]!, 'QA Agency Pending', 'AGENCY'), user(emails[3]!, 'QA Traveler', 'TRAVELER'),
    user(emails[4]!, 'QA Review Author', 'TRAVELER'),
  ]);
  const verified = await prisma.agencyProfile.create({ data: { userId: agencyOwner.id, companyName: `${marker} Verified Travel`, address: 'Ha Noi', licenseNumber: 'QA-MOD-VERIFIED', verificationStatus: 'VERIFIED', verifiedAt: new Date() } });
  const pending = await prisma.agencyProfile.create({ data: { userId: agencyOwner2.id, companyName: `${marker} Pending Travel`, address: 'Da Nang', licenseNumber: 'QA-MOD-PENDING', verificationStatus: 'PENDING', submittedAt: new Date() } });
  const category = await prisma.category.findFirst({ where: { isActive: true }, select: { id: true } });
  const tour = async (key: string, status: 'PENDING_REVIEW' | 'APPROVED') => prisma.tour.create({ data: {
    agencyId: verified.id, title: `${marker} ${key} Ha Long 3N2D`, summary: `Fixture ${key}`,
    description: 'Tour QA kiem duyet noi dung va trang thai.', destination: 'Quang Ninh', durationDays: 3,
    basePrice: 2_000_000, maxGroupSize: 20, status, submittedAt: new Date(),
    ...(status === 'APPROVED' ? { reviewedAt: new Date() } : {}),
    ...(category ? { categories: { connect: { id: category.id } } } : {}),
    departures: { create: [{ date: new Date(Date.now() + 40 * 86_400_000), capacity: 20, remaining: 20 }] },
  }, include: { departures: true } });
  const [approveTour, rejectTour, suspendTour, reviewTour] = await Promise.all([
    tour('APPROVE', 'PENDING_REVIEW'), tour('REJECT', 'PENDING_REVIEW'),
    tour('SUSPEND', 'APPROVED'), tour('REVIEW', 'APPROVED'),
  ]);
  const departure = reviewTour.departures[0]!;
  const booking = await prisma.booking.create({ data: {
    bookingCode: `QAMOD-${Date.now()}`, travelerId: violator.id, agencyId: verified.id,
    tourId: reviewTour.id, departureId: departure.id, tourTitle: reviewTour.title,
    departureDate: departure.date, endDate: new Date(departure.date.getTime() + 3 * 86_400_000),
    participants: 1, contactName: violator.fullName, contactPhone: '0900000000',
    unitPrice: 2_000_000, subtotal: 2_000_000, totalAmount: 2_000_000,
    commissionBps: 1000, commissionAmount: 200_000, agencyAmount: 1_800_000,
    status: 'COMPLETED', isPaid: true, completedAt: new Date(),
  } });
  const review = await prisma.review.create({ data: { bookingId: booking.id, tourId: reviewTour.id,
    tourTitle: reviewTour.title, agencyId: verified.id, travelerId: violator.id,
    rating: 1, comment: `${marker} Review co noi dung can kiem duyet.`, status: 'VISIBLE' } });
  const report = async (key: string, targetType: 'TOUR' | 'REVIEW' | 'USER', targetId: string, agencyId?: string, tourId?: string) =>
    prisma.report.create({ data: { reporterId: traveler.id, targetType, targetId, category: 'INAPPROPRIATE_CONTENT',
      description: `${marker} ${key}: Can xac minh noi dung va ghi ro ly do xu ly.`,
      agencyId, tourId, status: 'OPEN', openKey: `${traveler.id}:${targetType}:${targetId}` } });
  const [tourReport, reviewReport, userReport] = await Promise.all([
    report('TOUR', 'TOUR', suspendTour.id, verified.id, suspendTour.id),
    report('REVIEW', 'REVIEW', review.id, verified.id, reviewTour.id),
    report('USER', 'USER', violator.id),
  ]);
  const ticket = await prisma.supportTicket.create({ data: { userId: traveler.id,
    subject: `${marker} Ho tro dat tour`, category: 'TOUR', status: 'OPEN', messageCount: 1,
    messages: { create: [{ authorId: traveler.id, authorKind: 'USER', text: `${marker} Toi can duoc ho tro ve lich trinh tour.` }] } } });
  const complaint = await prisma.complaintTicket.create({ data: {
    ticketCode: `QAMOD-C-${Date.now()}`, travelerId: traveler.id, agencyId: verified.id,
    tourId: reviewTour.id, bookingId: booking.id, category: 'ITINERARY', subCategory: 'Lich trinh',
    subject: `${marker} Khieu nai lich trinh`, description: `${marker} Lich trinh thuc te khac voi mo ta tour.`,
    status: 'ESCALATED', priority: 'HIGH', escalatedAt: new Date(),
    messages: { create: [{ senderId: traveler.id, senderRole: 'TRAVELER', text: `${marker} De nghi moderator xem xet.` }] },
  } });
  console.log(JSON.stringify({ accounts: emails, password: 'DEV_MODERATOR_PASSWORD',
    agencies: { verified: verified.id, pending: pending.id },
    tours: { approve: approveTour.id, reject: rejectTour.id, suspend: suspendTour.id, review: reviewTour.id },
    review: review.id, reports: { tour: tourReport.id, review: reviewReport.id, user: userReport.id },
    ticket: ticket.id, complaint: complaint.id, moderator: moderator.id }, null, 2));
}

void main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
