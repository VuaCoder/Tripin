/**
 * Dev-only seed that fills the Super Admin screens with realistic demo data
 * (promotions table, per-agency commission rates, spread-out bookings, audit
 * logs, subscriptions, support/complaint queues). Idempotent on the two real
 * local databases (docker postgres at 127.0.0.1:5432 / travel_platform).
 *
 * Run: pnpm --filter backend seed:admin-demo
 */
import { connectDatabase, disconnectDatabase, prisma } from '../config/database';

const HOURLY = 60 * 60 * 1000;
const DAILY = 24 * HOURLY;
const daysAgo = (days: number, hour = 9) => new Date(Date.now() - days * DAILY + hour * HOURLY);

async function ensureAdmin(): Promise<{ id: string; role: string } | null> {
  return prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' }, select: { id: true, role: true } });
}

async function seedPromotions(adminId: string) {
  const rows: {
    code: string; title: string; description: string;
    discountType: 'FIXED' | 'PERCENT'; discountValue: number; maxDiscountAmount: number | null; minOrderAmount: number;
    applyType: 'CODE' | 'AUTO_APPLY' | 'COLLECTABLE'; codeType: 'SHARED' | 'UNIQUE_BATCH'; scope: 'PLATFORM' | 'AGENCY';
    startsAt: Date; endsAt: Date; usageLimit: number | null; usedCount: number; isActive: boolean; isArchived?: boolean; deactivationReason?: string;
  }[] = [
    {
      code: 'HELLOTRIP',
      title: 'Chào mừng thành viên mới',
      description: 'Giảm 100.000đ cho booking đầu tiên của hành khách mới.',
      discountType: 'FIXED' as const, discountValue: 100_000, maxDiscountAmount: null, minOrderAmount: 500_000,
      applyType: 'CODE', codeType: 'SHARED', scope: 'PLATFORM',
      startsAt: daysAgo(30), endsAt: daysAgo(-210), usageLimit: 5000, usedCount: 1247, isActive: true,
    },
    {
      code: 'SUMMER20',
      title: 'Mùa hè rực rỡ - giảm 20%',
      description: 'Giảm 20% cho các tour biển đảo, tối đa 500.000đ.',
      discountType: 'PERCENT' as const, discountValue: 20, maxDiscountAmount: 500_000, minOrderAmount: 1_000_000,
      applyType: 'CODE', codeType: 'SHARED', scope: 'PLATFORM',
      startsAt: daysAgo(45), endsAt: daysAgo(-75), usageLimit: 2000, usedCount: 1893, isActive: true,
    },
    {
      code: 'LOCAL15',
      title: 'Ưu đãi tour nội địa',
      description: 'Giảm 15% cho tour nội địa, áp dụng trong 2 tuần.',
      discountType: 'PERCENT' as const, discountValue: 15, maxDiscountAmount: 300_000, minOrderAmount: 800_000,
      applyType: 'CODE', codeType: 'SHARED', scope: 'PLATFORM',
      startsAt: daysAgo(10), endsAt: daysAgo(-3), usageLimit: 1000, usedCount: 220, isActive: true,
    },
    {
      code: 'PAYDAY10',
      title: 'Payday Weekend',
      description: 'Chiến dịch cuối tuần tự động giảm cho đơn trên 2 triệu.',
      discountType: 'FIXED' as const, discountValue: 200_000, maxDiscountAmount: null, minOrderAmount: 2_000_000,
      applyType: 'AUTO_APPLY', codeType: 'SHARED', scope: 'PLATFORM',
      startsAt: daysAgo(20), endsAt: daysAgo(-5), usageLimit: 3000, usedCount: 512, isActive: true,
    },
    {
      code: 'TRAVELER_VIP',
      title: 'Voucher thành viên VIP',
      description: 'Mã giảm dành riêng cho từng thành viên VIP.',
      discountType: 'PERCENT' as const, discountValue: 10, maxDiscountAmount: 250_000, minOrderAmount: 1_500_000,
      applyType: 'COLLECTABLE', codeType: 'UNIQUE_BATCH', scope: 'PLATFORM',
      startsAt: daysAgo(60), endsAt: daysAgo(-120), usageLimit: 10000, usedCount: 2311, isActive: true,
    },
    {
      code: 'OVERNIGHT50',
      title: 'Giảm 50% tour trong ngày',
      description: 'Mã đặc biệt cho tour day-trip, chỉ áp dụng từ 20:00-23:59.',
      discountType: 'PERCENT' as const, discountValue: 50, maxDiscountAmount: 150_000, minOrderAmount: 300_000,
      applyType: 'CODE', codeType: 'SHARED', scope: 'PLATFORM',
      startsAt: daysAgo(90), endsAt: daysAgo(-3), usageLimit: 500, usedCount: 490, isActive: false,
      deactivationReason: 'Chiến dịch kết thúc theo kế hoạch.',
    },
    {
      code: 'ARCHIVE_OLD',
      title: 'Lễ hội 2025 - đã lưu trữ',
      description: 'Chiến dịch cũ năm trước đã lưu trữ.',
      discountType: 'FIXED' as const, discountValue: 150_000, maxDiscountAmount: null, minOrderAmount: 700_000,
      applyType: 'CODE', codeType: 'SHARED', scope: 'PLATFORM',
      startsAt: daysAgo(300), endsAt: daysAgo(30), usageLimit: 800, usedCount: 800, isActive: false, isArchived: true,
    },
    {
      code: 'COASTAL100',
      title: 'Voucher riêng Coastal Journeys',
      description: 'Giảm 100.000đ cho khách của Coastal Journeys.',
      discountType: 'FIXED' as const, discountValue: 100_000, maxDiscountAmount: null, minOrderAmount: 1_000_000,
      applyType: 'CODE', codeType: 'SHARED', scope: 'AGENCY',
      startsAt: daysAgo(40), endsAt: daysAgo(-90), usageLimit: 2000, usedCount: 88, isActive: true,
    },
  ];
  let created = 0;
  for (const row of rows) {
    const existing = await prisma.promotion.findUnique({ where: { code: row.code } });
    if (existing) continue;
    await prisma.promotion.create({
      data: {
        ...row,
        createdById: adminId,
        scope: row.scope,
      },
    });
    created += 1;
  }
  // Unique-batch instances for the batch UI.
  const batchOwner = await prisma.promotion.findUnique({ where: { code: 'TRAVELER_VIP' } });
  const existingInstances = await prisma.promotionCodeInstance.count({ where: { promotionId: batchOwner?.id } });
  if (batchOwner && existingInstances === 0) {
    await prisma.promotionCodeInstance.createMany({
      data: Array.from({ length: 18 }, (_, i) => ({
        promotionId: batchOwner.id,
        code: `VIP-${String(1000 + i)}`,
        isUsed: i % 3 === 0,
        createdAt: daysAgo(50 - i),
      })),
    });
  }
  return created;
}

async function seedAgencyCommissions() {
  // Give a few real agencies distinct per-agency rates so the Phí dịch vụ table
  // shows a mix of "Mức riêng" and "Mức chung" rows.
  const agencies = await prisma.agencyProfile.findMany({
    where: { user: { role: 'AGENCY', status: 'ACTIVE' } },
    select: { id: true, companyName: true, commissionRateBps: true, commissionVersion: true },
  });
  // company-region → rateBps; bump a version each time we set one.
  const byName = new Map<string, number>([
    ['Coastal Journeys', 1200],
    ['Heritage Routes', 900],
    ['Wild North', 1100],
  ]);
  let updated = 0;
  for (const a of agencies) {
    let rate: number | null = null;
    for (const [name, bps] of byName) if (a.companyName?.includes(name)) { rate = bps; break; }
    if (rate === null) continue; // keep the rest on the platform default
    if (a.commissionRateBps !== rate) {
      await prisma.agencyProfile.update({
        where: { id: a.id },
        data: { commissionRateBps: rate, commissionVersion: { increment: 1 } },
      });
      updated += 1;
    }
  }
  return updated;
}

async function seedBookings() {
  const agencies = await prisma.agencyProfile.findMany({
    where: { user: { role: 'AGENCY', status: 'ACTIVE' } },
    select: { id: true, companyName: true },
  });
  const travelers = await prisma.user.findMany({ where: { role: 'TRAVELER', status: 'ACTIVE' }, select: { id: true, fullName: true } });
  const tours = await prisma.tour.findMany({ where: { status: 'APPROVED' }, select: { id: true, title: true, agencyId: true, basePrice: true, durationDays: true } });
  if (agencies.length === 0 || travelers.length === 0 || tours.length === 0) {
    console.log('  [bookings] skipped: not enough agencies/travelers/tours');
    return;
  }
  const existingCodes = new Set((await prisma.booking.findMany({ select: { bookingCode: true } })).map((b) => b.bookingCode));
  let created = 0;
  const statuses: Array<'COMPLETED' | 'CONFIRMED' | 'PENDING' | 'CANCELLED'> = ['COMPLETED', 'CONFIRMED', 'CONFIRMED', 'COMPLETED', 'PENDING', 'CANCELLED', 'COMPLETED', 'CONFIRMED'];
  const createBooking = async (
    code: string,
    i: number,
    confirmedDaysAgo: number,
    opts: { spreadMonths: boolean },
  ) => {
    if (existingCodes.has(code)) return false;
    const tour = tours[i % tours.length]!;
    const agency = agencies.find((a) => a.id === tour.agencyId) ?? agencies[0]!;
    const traveler = travelers[i % travelers.length]!;
    const status = statuses[i % statuses.length]!;
    const participants = (i % 4) + 1;
    const base = Number(tour.basePrice);
    const unitPrice = base;
    const subtotal = base * participants;
    const discountAmount = i % 3 === 0 ? Math.round(subtotal * 0.1) : 0;
    const totalAmount = subtotal - discountAmount;
    const commissionBps = 1000;
    const commissionAmount = Math.round((totalAmount * commissionBps) / 10000);
    const agencyAmount = totalAmount - commissionAmount;
    // confirmedAt in the past for the monthly chart; departure in the future.
    const confirmedAt = daysAgo(confirmedDaysAgo);
    const departureDays = opts.spreadMonths ? -(14 + (i % 40)) : -(7 + (i % 20));
    const departureDate = daysAgo(departureDays, 8);
    const endDate = new Date(departureDate.getTime() + (tour.durationDays ?? 2) * DAILY);
    await prisma.booking.create({
      data: {
        bookingCode: code,
        travelerId: traveler.id,
        agencyId: agency.id,
        tourId: tour.id,
        tourTitle: tour.title,
        departureId: (await prisma.tourDeparture.findFirst({ where: { tourId: tour.id }, select: { id: true } }))?.id ??
          (await prisma.tourDeparture.create({ data: { tourId: tour.id, date: departureDate, capacity: 24, remaining: 24 } })).id,
        departureDate,
        endDate,
        participants,
        contactName: traveler.fullName,
        contactPhone: `090${String(1000000 + i)}`,
        unitPrice,
        subtotal,
        discountAmount,
        totalAmount,
        commissionBps,
        commissionAmount,
        agencyAmount,
        status,
        isPaid: status !== 'PENDING' && status !== 'CANCELLED',
        confirmedAt: status === 'COMPLETED' || status === 'CONFIRMED' ? confirmedAt : status === 'CANCELLED' ? daysAgo(10) : null,
        completedAt: status === 'COMPLETED' ? daysAgo(Math.max(1, confirmedDaysAgo - 3)) : null,
        cancelledAt: status === 'CANCELLED' ? daysAgo(10) : null,
        cancelReason: status === 'CANCELLED' ? 'TRAVELER_REQUEST' : null,
        createdAt: confirmedAt,
        updatedAt: confirmedAt,
      },
    });
    return true;
  };
  // Batch 1: 26 bookings over the last ~6 months (existing behaviour).
  const months = [170, 135, 100, 65, 30, 8];
  for (let i = 0; i < 26; i++) {
    if (await createBooking(`DEMO-BOOK-${100 + i}`, i, months[i % months.length]!, { spreadMonths: false })) created += 1;
  }
  // Batch 2: 50 more bookings spread evenly across the last 12 months so the
  // monthly chart has a clear 12-point curve.
  const yearMonths = [360, 330, 300, 270, 240, 210, 180, 150, 120, 90, 45, 10];
  for (let i = 0; i < 50; i++) {
    if (await createBooking(`DEMO-BOOK-${200 + i}`, i, yearMonths[i % yearMonths.length]!, { spreadMonths: true })) created += 1;
  }
  return created;
}

async function seedAuditLogs(adminId: string) {
  const actions: [string, string, string][] = [
    ['auth.admin_logged_in', 'user', 'Đăng nhập admin từ Hà Nội'],
    ['users.role_changed', 'user', 'Nâng quyền uitest.traveler lên MODERATOR'],
    ['settings.commission_updated', 'setting', 'Thay đổi hoa hồng nền tảng 10% → 12%'],
    ['settings.policy_updated', 'setting', 'Cập nhật chính sách hoàn tiền (refund)'],
    ['promotions.created', 'promotion', 'Tạo voucher SUMMER20'],
    ['promotions.status_changed', 'promotion', 'Tắt voucher OVERNIGHT50'],
    ['users.banned', 'user', 'Khóa tài khoản vi phạm user@spam.com'],
    ['tours.suspended', 'tour', 'Tạm khóa tour “Vịnh Hạ Long” vì ảnh không đúng'],
    ['settings.agency_commission_updated', 'agency', 'Đặt mức riêng 12% cho Coastal Journeys'],
    ['moderation.report_resolved', 'report', 'Xử lý báo cáo “Ảnh không đúng thực tế”'],
    ['users.unbanned', 'user', 'Mở khóa tài khoản sau kháng nghị'],
    ['promotions.archived', 'promotion', 'Lưu trữ chiến dịch Lễ hội 2025'],
  ];
  let created = 0;
  for (let i = 0; i < actions.length; i++) {
    const [action, targetType, detail] = actions[i]!;
    const exists = await prisma.auditLog.findFirst({ where: { action, actorId: adminId } });
    if (exists) continue;
    await prisma.auditLog.create({
      data: {
        actorId: adminId,
        actorRole: 'SUPER_ADMIN',
        action,
        targetType,
        targetId: adminId,
        metadata: { detail },
        createdAt: daysAgo(i),
      },
    });
    created += 1;
  }
  return created;
}

async function seedSubscriptions() {
  const plan = await prisma.subscriptionPlan.findFirst({ where: { code: 'GUIDE_MONTHLY' } });
  const guides = await prisma.user.findMany({ where: { role: 'TOUR_GUIDE', status: 'ACTIVE' }, select: { id: true } });
  if (!plan || guides.length === 0) { console.log('  [subscriptions] skipped'); return 0; }
  let created = 0;
  for (let i = 0; i < Math.min(3, guides.length); i++) {
    const guide = guides[i]!;
    const exists = await prisma.subscription.findFirst({ where: { userId: guide.id, status: 'ACTIVE' } });
    if (exists) continue;
    const startsAt = daysAgo(30 - i * 10);
    await prisma.subscription.create({
      data: {
        userId: guide.id,
        planId: plan.id,
        planCode: plan.code,
        planName: plan.name,
        price: plan.price,
        durationDays: plan.durationDays,
        isPremium: plan.isPremium,
        audience: 'TOUR_GUIDE',
        entitlementSnapshot: {},
        status: 'ACTIVE',
        startsAt,
        endsAt: new Date(startsAt.getTime() + plan.durationDays * DAILY),
        benefitsGrantedAt: startsAt,
      },
    });
    created += 1;
  }
  return created;
}

async function seedSupportAndComplaints() {
  const travelers = await prisma.user.findMany({ where: { role: 'TRAVELER', status: 'ACTIVE' }, select: { id: true } });
  const agencies = await prisma.agencyProfile.findMany({ select: { id: true } });
  const tours = await prisma.tour.findMany({ where: { status: 'APPROVED' }, select: { id: true } });
  let createdTickets = 0;
  const ticketSubjects = [
    ['BOOKING', 'Không nhận được email xác nhận booking', 'OPEN'],
    ['PAYMENT', 'Hỏi về chính sách hoàn tiền khi hủy tour', 'IN_PROGRESS'],
    ['ACCOUNT', 'Không thể đổi mật khẩu', 'OPEN'],
    ['TOUR', 'Muốn thêm người vào đoàn hiện có', 'RESOLVED'],
  ] as const;
  for (const [category, subject, status] of ticketSubjects) {
    const exists = await prisma.supportTicket.findFirst({ where: { subject } });
    if (exists) continue;
    const traveler = travelers[createdTickets % travelers.length]!;
    await prisma.supportTicket.create({
      data: {
        userId: traveler.id,
        subject,
        category,
        status,
        messageCount: 2,
        lastMessageAt: daysAgo(createdTickets),
      },
    });
    createdTickets += 1;
  }
  let createdComplaints = 0;
  const complaints = [
    ['TRANSPORT', 'Điểm đón bị đổi không báo trước', 'OPEN', 'NORMAL'],
    ['ACCOMMODATION_DINING', 'Khách sạn không đúng như mô tả', 'IN_PROGRESS', 'URGENT'],
    ['GUIDE_SERVICE', 'HDV xuất hiện muộn 1 giờ', 'OPEN', 'NORMAL'],
    ['ITINERARY', 'Chương trình bị cắt ngắn so với quảng cáo', 'OPEN', 'HIGH'],
  ] as const;
  for (const [category, subject, status, priority] of complaints) {
    const exists = await prisma.complaintTicket.findFirst({ where: { subject } });
    if (exists) continue;
    const ticketCode = `CMP-${String(Date.now()).slice(-6)}${createdComplaints}`;
    const traveler = travelers[createdComplaints % travelers.length]!;
    const agency = agencies[createdComplaints % agencies.length]!;
    const tour = tours[createdComplaints % tours.length]!;
    await prisma.complaintTicket.create({
      data: {
        ticketCode,
        travelerId: traveler.id,
        agencyId: agency.id,
        tourId: tour.id,
        category,
        subCategory: subject,
        subject,
        description: `Nội dung khiếu nại: ${subject}. Khách mong được bên agency làm rõ và khắc phục.`,
        status,
        priority,
        lastMessageAt: daysAgo(createdComplaints),
      },
    });
    createdComplaints += 1;
  }
  return { createdTickets, createdComplaints };
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  await connectDatabase(url);
  try {
    const admin = await ensureAdmin();
    if (!admin) throw new Error('No SUPER_ADMIN found in DB; run `pnpm --filter backend seed` first');
    const promos = await seedPromotions(admin.id);
    const agenciesComm = await seedAgencyCommissions();
    const bookings = await seedBookings();
    const audits = await seedAuditLogs(admin.id);
    const subs = await seedSubscriptions();
    const { createdTickets, createdComplaints } = await seedSupportAndComplaints();
    console.log(`[seed:admin-demo] promotions ${promos}; agency commissions ${agenciesComm}; bookings ${bookings}; audit logs ${audits}; subscriptions ${subs}; support tickets ${createdTickets}; complaints ${createdComplaints}`);
  } finally {
    await disconnectDatabase();
  }
}

main().catch((error) => {
  console.error(`[seed:admin-demo] failed: ${(error as Error).message}`);
  process.exit(1);
});
