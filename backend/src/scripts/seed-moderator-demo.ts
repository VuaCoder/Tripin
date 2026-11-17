/** A one-time, isolated moderator walkthrough on the explicitly selected development database. */
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';

const marker = '[DEMO-MOD]';
const host = new URL(process.env.DATABASE_URL ?? 'postgresql://localhost').hostname;
const expectedHost = process.argv.find((arg) => arg.startsWith('--expected-host='))?.slice('--expected-host='.length);
if (process.env.NODE_ENV === 'production' || !expectedHost || host !== expectedHost) {
  throw new Error('Use a non-production database and pass --expected-host=<exact DATABASE_URL hostname>.');
}

const emails = {
  moderator: 'moderator@demo-moderator.tripri.test',
  agency: 'agency@demo-moderator.tripri.test',
  pending: 'pending-agency@demo-moderator.tripri.test',
  traveler: 'traveler@demo-moderator.tripri.test',
  reviewAuthor: 'review-author@demo-moderator.tripri.test',
};

async function main() {
  if (await prisma.user.count({ where: { email: { in: Object.values(emails) } } })) {
    throw new Error('Demo moderator accounts already exist. No data was changed.');
  }
  const category = await prisma.category.findFirst({ where: { isActive: true }, select: { id: true } });
  if (!category) throw new Error('Seed active categories first. No data was changed.');
  const password = randomBytes(18).toString('base64url');
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();
  const departureDate = new Date(now.getTime() + 45 * 86_400_000);

  const result = await prisma.$transaction(async (tx) => {
    const createUser = (email: string, fullName: string, role: 'MODERATOR' | 'AGENCY' | 'TRAVELER') =>
      tx.user.create({ data: { email, fullName, role, passwordHash, status: 'ACTIVE', emailVerifiedAt: now, phone: '0900000000' } });
    const moderator = await createUser(emails.moderator, 'Minh Anh - Kiểm duyệt demo', 'MODERATOR');
    const agencyOwner = await createUser(emails.agency, 'Lan Hương - Đại diện Hạ Long', 'AGENCY');
    const pendingOwner = await createUser(emails.pending, 'Quốc Bảo - Đại diện Đà Nẵng', 'AGENCY');
    const traveler = await createUser(emails.traveler, 'Ngọc Hà - Du khách', 'TRAVELER');
    const reviewAuthor = await createUser(emails.reviewAuthor, 'Hoàng Nam - Khách đánh giá', 'TRAVELER');

    const agency = await tx.agencyProfile.create({ data: {
      userId: agencyOwner.id, companyName: `${marker} Hạ Long Xanh Travel`,
      description: 'Đơn vị tổ chức hành trình tham quan Hạ Long và Quảng Ninh.',
      address: '12 Hạ Long, Bãi Cháy, Quảng Ninh', licenseNumber: 'DEMO-MOD-HLX-2026',
      taxId: 'DEMO-MOD-001', website: 'https://example.com',
      verificationStatus: 'VERIFIED', verifiedAt: now, verifiedById: moderator.id,
      submittedAt: new Date(now.getTime() - 7 * 86_400_000),
    } });
    const pendingAgency = await tx.agencyProfile.create({ data: {
      userId: pendingOwner.id, companyName: `${marker} Đà Nẵng Heritage`,
      description: 'Đơn vị du lịch văn hóa tại Đà Nẵng và Hội An.',
      address: '28 Bạch Đằng, Hải Châu, Đà Nẵng', licenseNumber: 'DEMO-MOD-DNH-2026',
      taxId: 'DEMO-MOD-002', website: 'https://example.org',
      verificationStatus: 'PENDING', submittedAt: new Date(now.getTime() - 2 * 86_400_000),
    } });
    // Existing legacy-agency triggers may create OWNER memberships. Create only when absent.
    for (const [profileId, ownerId] of [[agency.id, agencyOwner.id], [pendingAgency.id, pendingOwner.id]] as const) {
      const member = await tx.agencyMember.findUnique({ where: { agencyId_userId: { agencyId: profileId, userId: ownerId } } });
      if (!member) await tx.agencyMember.create({ data: { agencyId: profileId, userId: ownerId, role: 'OWNER' } });
    }

    const makeTour = (key: string, status: 'PENDING_REVIEW' | 'APPROVED') => tx.tour.create({ data: {
      agencyId: agency.id, title: `${marker} ${key} - Hạ Long 3 ngày 2 đêm`,
      summary: 'Du thuyền Hạ Long, hang Sửng Sốt và đảo Ti Tốp.',
      description: 'Hành trình tham quan Hạ Long 3 ngày 2 đêm, có hướng dẫn viên, lưu trú và bữa ăn theo lịch trình.',
      destination: 'Quảng Ninh', durationDays: 3, basePrice: 2_900_000, maxGroupSize: 20,
      meetingPoint: 'Bến tàu du lịch Bãi Cháy, Hạ Long',
      highlights: ['Hang Sửng Sốt', 'Đảo Ti Tốp', 'Du thuyền trên vịnh'],
      inclusions: ['Xe đưa đón', 'Hướng dẫn viên', '2 đêm lưu trú', 'Bữa ăn theo chương trình'],
      exclusions: ['Chi phí cá nhân', 'Đồ uống ngoài chương trình'],
      itinerary: [
        { day: 1, title: 'Đón khách và lên du thuyền', activities: ['Tập trung tại Bãi Cháy', 'Tham quan vịnh'] },
        { day: 2, title: 'Hang Sửng Sốt và đảo Ti Tốp', activities: ['Tham quan hang', 'Tắm biển'] },
        { day: 3, title: 'Trở về bờ', activities: ['Ăn sáng', 'Kết thúc hành trình'] },
      ],
      travelNotes: 'Có mặt tại điểm hẹn trước giờ khởi hành 30 phút.',
      cancellationPolicy: 'Liên hệ đối tác để được hỗ trợ đổi hoặc hủy lịch.',
      status, submittedAt: now, ...(status === 'APPROVED' ? { reviewedAt: now, reviewedById: moderator.id } : {}),
      categories: { connect: { id: category.id } },
      departures: { create: [{ date: departureDate, capacity: 20, remaining: 20 }] },
    }, include: { departures: true } });
    const approve = await makeTour('DUYỆT', 'PENDING_REVIEW');
    const reject = await makeTour('TỪ CHỐI', 'PENDING_REVIEW');
    const suspend = await makeTour('TẠM DỪNG', 'APPROVED');
    const reviewTour = await makeTour('ĐÁNH GIÁ', 'APPROVED');
    const pastDepartureDate = new Date(now.getTime() - 30 * 86_400_000);
    const pastDeparture = await tx.tourDeparture.create({ data: {
      tourId: reviewTour.id, date: pastDepartureDate, capacity: 20, remaining: 19, isOpen: false,
    } });

    const booking = await tx.booking.create({ data: {
      bookingCode: `DMOD-${Date.now()}`, travelerId: reviewAuthor.id, agencyId: agency.id,
      tourId: reviewTour.id, departureId: pastDeparture.id, tourTitle: reviewTour.title,
      departureDate: pastDepartureDate, endDate: new Date(pastDepartureDate.getTime() + 2 * 86_400_000),
      participants: 1, contactName: reviewAuthor.fullName, contactPhone: '0900000000',
      unitPrice: 2_900_000, subtotal: 2_900_000, totalAmount: 2_900_000,
      commissionBps: 1000, commissionAmount: 290_000, agencyAmount: 2_610_000,
      status: 'COMPLETED', isPaid: true, confirmedAt: now, completedAt: now,
    } });
    const review = await tx.review.create({ data: {
      bookingId: booking.id, tourId: reviewTour.id, tourTitle: reviewTour.title,
      agencyId: agency.id, travelerId: reviewAuthor.id, rating: 1,
      comment: `${marker} Lịch trình thực tế chưa giống mô tả, cần xác minh với đối tác.`, status: 'VISIBLE',
    } });
    await tx.tour.update({ where: { id: reviewTour.id }, data: { ratingAvg: 1, ratingCount: 1 } });

    const makeReport = (targetType: 'TOUR' | 'REVIEW' | 'USER', targetId: string, description: string, tourId?: string) =>
      tx.report.create({ data: {
        reporterId: traveler.id, targetType, targetId, category: 'INAPPROPRIATE_CONTENT',
        description: `${marker} ${description}`, agencyId: tourId ? agency.id : undefined, tourId,
        status: 'OPEN', openKey: `${traveler.id}:${targetType}:${targetId}`,
      } });
    const tourReport = await makeReport('TOUR', suspend.id, 'Thông tin an toàn của tour cần được kiểm tra.', suspend.id);
    const reviewReport = await makeReport('REVIEW', review.id, 'Đánh giá có nội dung cần kiểm tra.', reviewTour.id);
    const userReport = await makeReport('USER', reviewAuthor.id, 'Tài khoản đăng nội dung cần xác minh.');

    const ticket = await tx.supportTicket.create({ data: {
      userId: traveler.id, subject: `${marker} Hỗ trợ thông tin lịch trình`,
      category: 'TOUR', status: 'OPEN', messageCount: 1,
      messages: { create: [{ authorId: traveler.id, authorKind: 'USER', text: 'Tôi cần xác nhận giờ tập trung và địa điểm đón khách.' }] },
    } });
    const complaint = await tx.complaintTicket.create({ data: {
      ticketCode: `DMOD-C-${Date.now()}`, travelerId: reviewAuthor.id, agencyId: agency.id,
      tourId: reviewTour.id, bookingId: booking.id, category: 'ITINERARY', subCategory: 'Sai lịch trình',
      subject: `${marker} Khiếu nại lịch trình Hạ Long`,
      description: 'Lịch trình thực tế khác với nội dung đã đăng. Tôi đề nghị đối tác và moderator xem xét.',
      status: 'ESCALATED', priority: 'HIGH', escalatedAt: now,
      messages: { create: [
        { senderId: reviewAuthor.id, senderRole: 'TRAVELER', text: 'Tôi đã gửi thông tin lịch trình thực tế để đối chiếu.' },
        { senderId: agencyOwner.id, senderRole: 'AGENCY', text: 'Đối tác đã nhận phản ánh và đang kiểm tra với điều hành tour.' },
        { senderId: reviewAuthor.id, senderRole: 'TRAVELER', text: 'Tôi đề nghị moderator phân xử vì chưa thống nhất được phương án.' },
      ] },
    } });
    return { moderator: moderator.id, agencies: [agency.id, pendingAgency.id], tours: [approve.id, reject.id, suspend.id, reviewTour.id], booking: booking.id, review: review.id, reports: [tourReport.id, reviewReport.id, userReport.id], ticket: ticket.id, complaint: complaint.id };
  }, { maxWait: 20_000, timeout: 60_000 });

  console.log(JSON.stringify({ marker, accounts: emails, password, result }, null, 2));
}

void main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
