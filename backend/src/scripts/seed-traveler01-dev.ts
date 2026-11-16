/** Additive development fixtures for Traveler01; reruns preserve existing test activity. */
import { randomInt, randomUUID } from 'node:crypto';
import { prisma, disconnectDatabase } from '../config/database';
import { env } from '../config/env';

const DAY = 86_400_000;
const PREFIX = 'TRV01-DEMO';

async function main() {
  if (env.NODE_ENV !== 'development') throw new Error('Development environment required.');
  const now = new Date();
  const ago = (days: number) => new Date(now.getTime() - days * DAY);
  const later = (days: number) => new Date(now.getTime() + days * DAY);
  const user = await prisma.user.findUniqueOrThrow({ where: { email: 'traveler01@tripri.test' } });
  if (user.fullName !== 'Traveler01' || user.role !== 'TRAVELER' || user.status !== 'ACTIVE') {
    throw new Error('Expected the active Traveler01 test account.');
  }
  const admin = await prisma.user.findFirstOrThrow({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE' } });
  const tours = await prisma.tour.findMany({
    where: { status: 'APPROVED', visibility: 'PUBLIC', basePrice: { gte: 500_000n }, durationDays: { lte: 7 } },
    include: { departures: { orderBy: { date: 'asc' } } },
    orderBy: { title: 'asc' },
  });
  const upcoming = tours.filter(t => t.departures.some(d => d.isOpen && d.date > later(3) && d.remaining >= 3));
  const past = tours.find(t => t.departures.some(d => d.date.getTime() + t.durationDays * DAY < ago(2).getTime() && d.remaining >= 2));
  if (upcoming.length < 5 || !past) throw new Error('Need five bookable tours and one past departure.');
  const wishlistTours = upcoming.slice(0, 5);

  await prisma.$transaction(async tx => {
    for (const tour of wishlistTours) {
      await tx.wishlistItem.upsert({
        where: { userId_tourId: { userId: user.id, tourId: tour.id } },
        create: { userId: user.id, tourId: tour.id }, update: {},
      });
    }
    for (const tour of upcoming.slice(3, 5)) {
      const departure = tour.departures.find(d => d.isOpen && d.date > later(3) && d.remaining >= 3)!;
      await tx.cartItem.upsert({
        where: { userId_departureId: { userId: user.id, departureId: departure.id } },
        create: { userId: user.id, tourId: tour.id, departureId: departure.id, participants: 2 }, update: {},
      });
    }

    const vouchers = [
      { code: 'TRV01-100K', title: '[TEST Traveler01] Giảm 100.000đ', discountType: 'FIXED' as const, discountValue: 100_000n, minOrderAmount: 500_000n, maxDiscountAmount: null, endsAt: later(60) },
      { code: 'TRV01-10PCT', title: '[TEST Traveler01] Giảm 10%, tối đa 300.000đ', discountType: 'PERCENT' as const, discountValue: 10n, minOrderAmount: 1_000_000n, maxDiscountAmount: 300_000n, endsAt: later(45) },
      { code: 'TRV01-USED50K', title: '[TEST Traveler01] Voucher đã sử dụng', discountType: 'FIXED' as const, discountValue: 50_000n, minOrderAmount: 0n, maxDiscountAmount: null, endsAt: later(30) },
      { code: 'TRV01-EXPIRED', title: '[TEST Traveler01] Voucher đã hết hạn', discountType: 'FIXED' as const, discountValue: 200_000n, minOrderAmount: 1_000_000n, maxDiscountAmount: null, endsAt: ago(2) },
    ];
    const promotionIds: string[] = [];
    for (const voucher of vouchers) {
      const existing = await tx.promotion.findUnique({ where: { code: voucher.code } });
      if (existing && !existing.title.startsWith('[TEST Traveler01]')) throw new Error('Voucher code collision.');
      const promotion = existing ?? await tx.promotion.create({ data: {
        ...voucher, scope: 'PLATFORM', applyType: 'COLLECTABLE', codeType: 'SHARED',
        description: 'Dữ liệu mẫu cho tài khoản Traveler01 trong môi trường development.',
        createdById: admin.id, startsAt: ago(30), usageLimit: 1, usageLimitPerUser: 1,
      } });
      promotionIds.push(promotion.id);
      await tx.userVoucher.upsert({
        where: { userId_promotionId: { userId: user.id, promotionId: promotion.id } },
        create: { userId: user.id, promotionId: promotion.id, collectedAt: ago(5) }, update: {},
      });
    }

    const usedPromotionId = promotionIds[2];
    const usedVoucher = vouchers[2];
    if (!usedPromotionId || !usedVoucher) throw new Error('Missing used-voucher fixture.');
    const scenarios = [
      { status: 'PENDING' as const, tour: upcoming[0], participants: 2, daysAgo: 0 },
      { status: 'CONFIRMED' as const, tour: upcoming[1], participants: 3, daysAgo: 2 },
      { status: 'COMPLETED' as const, tour: past, participants: 2, daysAgo: 40 },
      { status: 'CANCELLED' as const, tour: upcoming[2], participants: 1, daysAgo: 3 },
    ];
    for (const scenario of scenarios) {
      const { status, tour, participants, daysAgo } = scenario;
      if (!tour) throw new Error('Missing tour for booking scenario.');
      const bookingCode = `${PREFIX}-${status}`;
      const existing = await tx.booking.findUnique({ where: { bookingCode } });
      if (existing) {
        if (existing.travelerId !== user.id) throw new Error('Booking code collision.');
        continue;
      }
      const departure = tour.departures.find(d => status === 'COMPLETED'
        ? d.date.getTime() + tour.durationDays * DAY < ago(2).getTime() && d.remaining >= participants
        : d.isOpen && d.date > later(3) && d.remaining >= participants)!;
      if (status !== 'CANCELLED') {
        const reserved = await tx.tourDeparture.updateMany({
          where: { id: departure.id, remaining: { gte: participants } }, data: { remaining: { decrement: participants } },
        });
        if (reserved.count !== 1) throw new Error('Departure no longer has enough seats.');
      }
      const paid = status === 'CONFIRMED' || status === 'COMPLETED';
      const createdAt = status === 'COMPLETED' ? new Date(departure.date.getTime() - 7 * DAY) : ago(daysAgo);
      const unitPrice = departure.priceOverride ?? tour.basePrice;
      const subtotal = unitPrice * BigInt(participants);
      const discountAmount = status === 'CONFIRMED' ? 50_000n : 0n;
      const totalAmount = subtotal - discountAmount;
      const commissionAmount = (totalAmount * 1000n + 5000n) / 10000n;
      const endDate = new Date(departure.date.getTime() + tour.durationDays * DAY);
      const confirmedAt = paid ? new Date(createdAt.getTime() + 60_000) : null;
      const booking = await tx.booking.create({ data: {
        bookingCode, travelerId: user.id, agencyId: tour.agencyId, tourId: tour.id, departureId: departure.id,
        tourTitle: tour.title, departureDate: departure.date, endDate, participants,
        contactName: 'Traveler01', contactPhone: '0900000001',
        notes: '[TEST Traveler01] Dữ liệu mẫu; không có giao dịch thanh toán thật.',
        passengerSnapshot: Array.from({ length: participants }, (_, index) => ({
          passengerId: randomUUID(), fullName: index === 0 ? 'Traveler01' : `Hành khách mẫu ${index + 1}`,
          birthYear: 2000 + index, ageGroup: 'ADULT', phone: '0900000001',
          pickupPoint: tour.meetingPoint || 'Tập trung theo hướng dẫn của agency',
          ...(index === 1 ? { specialNotes: 'Ăn chay, vui lòng hỗ trợ suất ăn phù hợp.' } : {}),
        })),
        meetingPointSnapshot: tour.meetingPoint, unitPrice, subtotal, discountAmount, totalAmount,
        commissionBps: 1000, commissionAmount, agencyAmount: totalAmount - commissionAmount,
        status, isPaid: paid, createdAt, confirmedAt,
        completedAt: status === 'COMPLETED' ? endDate : null,
        cancelledAt: status === 'CANCELLED' ? ago(2) : null,
        cancelReason: status === 'CANCELLED' ? 'TRAVELER_REQUEST' : null,
        cancelNote: status === 'CANCELLED' ? 'Hủy booking mẫu để kiểm tra lịch sử đặt chỗ.' : null,
        paymentExpiresAt: status === 'PENDING' ? new Date(now.getTime() + 30 * 60_000) : null,
        cancellationPolicySnapshot: { cancellationWindowHours: 24 }, fulfillmentStatus: paid ? 'COMPLETED' : 'PENDING',
        ...(status === 'CONFIRMED' ? { promotionId: usedPromotionId, promotionCode: usedVoucher.code, promotionScope: 'PLATFORM' } : {}),
      } });
      if (status === 'CONFIRMED') {
        await tx.userVoucher.update({ where: { userId_promotionId: { userId: user.id, promotionId: usedPromotionId } }, data: { isUsed: true, usedAt: confirmedAt, bookingId: booking.id } });
        await tx.promotion.update({ where: { id: usedPromotionId }, data: { usedCount: { increment: 1 } } });
        await tx.promotionRedemption.create({ data: { bookingId: booking.id, promotionId: usedPromotionId, scope: 'PLATFORM', code: usedVoucher.code, discountAmount } });
      }
      if (paid) {
        await tx.payment.create({ data: {
          purpose: 'BOOKING', userId: user.id, referenceId: booking.id, amount: totalAmount,
          description: `[TEST] ${bookingCode} — thanh toán giả lập`, provider: 'DEV_FIXTURE',
          providerOrderCode: BigInt(Date.now()) * 1000n + BigInt(randomInt(1000)),
          status: 'PAID', expiresAt: new Date(createdAt.getTime() + 30 * 60_000), paidAt: confirmedAt, fulfilledAt: confirmedAt, createdAt,
        } });
        await tx.eTicket.create({ data: {
          bookingId: booking.id, bookingCode, code: `ET-TRV01-${randomUUID().slice(0, 8).toUpperCase()}`,
          travelerId: user.id, agencyId: tour.agencyId, tourId: tour.id, tourTitle: tour.title,
          departureDate: departure.date, participants, holderName: 'Traveler01',
          status: status === 'COMPLETED' ? 'USED' : 'VALID', issuedAt: confirmedAt!,
          usedAt: status === 'COMPLETED' ? departure.date : null,
        } });
      }
    }
  }, { timeout: 60_000, maxWait: 15_000 });

  console.log(JSON.stringify({
    account: user.email,
    wishlist: await prisma.wishlistItem.count({ where: { userId: user.id } }),
    cart: await prisma.cartItem.count({ where: { userId: user.id } }),
    bookings: await prisma.booking.findMany({ where: { travelerId: user.id }, select: { bookingCode: true, status: true, tourTitle: true, paymentExpiresAt: true } }),
    vouchers: await prisma.userVoucher.count({ where: { userId: user.id } }),
    tickets: await prisma.eTicket.count({ where: { travelerId: user.id } }),
    simulatedPayments: await prisma.payment.count({ where: { userId: user.id, provider: 'DEV_FIXTURE' } }),
  }, null, 2));
}

void main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(disconnectDatabase);
