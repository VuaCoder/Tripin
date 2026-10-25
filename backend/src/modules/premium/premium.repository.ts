import { randomUUID } from 'node:crypto';
import { prisma, type Prisma } from '../../config/database';
import { AppError } from '../../utils/app-error';
import {
  assertRefundable,
  continuousPremiumEnd,
  premiumDiscount,
  type VoucherTerms,
} from './premium.policy';
import type {
  ContributionInput,
  GuideProfileInput,
  PlanInput,
} from './premium.validation';
import { earningsRepository } from '../earnings/earnings.repository';

const json = (value: unknown) => value as Prisma.InputJsonValue;
const DAY = 86_400_000;
export const premiumRepository = {
  async status(userId: string, now = new Date()) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user || !['TRAVELER', 'TOUR_GUIDE'].includes(user.role))
      return {
        active: false,
        endsAt: null,
        current: null,
        expired: false,
        periods: [],
      };
    const periods = await prisma.subscription.findMany({
      where: {
        userId,
        audience: user.role,
        isPremium: true,
        status: 'ACTIVE',
        revokedAt: null,
        endsAt: { gt: now },
      },
      orderBy: { startsAt: 'asc' },
    });
    const current = periods.find((p) => p.startsAt && p.startsAt <= now);
    const endsAt = continuousPremiumEnd(periods, now);
    const previous =
      !current &&
      (await prisma.subscription.findFirst({
        where: {
          userId,
          audience: user.role,
          isPremium: true,
          revokedAt: null,
          status: { in: ['ACTIVE', 'EXPIRED'] },
          endsAt: { lte: now },
        },
      }));
    return {
      active: !!endsAt,
      endsAt: endsAt?.toISOString() ?? null,
      current: current ?? null,
      expired: !!previous,
      periods,
    };
  },
  plans(audience: 'TRAVELER' | 'TOUR_GUIDE', admin = false) {
    return prisma.subscriptionPlan.findMany({
      where: {
        isPremium: true,
        ...(admin ? {} : { audience, isActive: true, published: true }),
      },
      include: { premiumVouchers: { include: { contribution: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  },
  async createPlan(input: PlanInput) {
    return prisma.$transaction(async (tx) => {
      const sources = await tx.premiumContribution.findMany({
        where: {
          id: { in: input.vouchers.map((v) => v.contributionId) },
          status: 'APPROVED',
          acceptingNew: true,
        },
      });
      if (sources.length !== input.vouchers.length)
        throw AppError.conflict(
          'Nguồn voucher chưa được duyệt hoặc đã ngừng bán',
        );
      const { vouchers, ...data } = input;
      return tx.subscriptionPlan.create({
        data: {
          ...data,
          isPremium: true,
          isActive: false,
          published: false,
          premiumVouchers: { create: vouchers },
        },
      });
    });
  },
  async publishPlan(id: string, published: boolean) {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id, isPremium: true },
      include: { premiumVouchers: { include: { contribution: true } } },
    });
    if (!plan) throw AppError.notFound();
    if (
      published &&
      (plan.price <= 0 ||
        plan.durationDays <= 0 ||
        !plan.benefits.length ||
        (plan.audience === 'TRAVELER' && !plan.premiumVouchers.length) ||
        plan.premiumVouchers.some(
          (v) =>
            v.contribution.status !== 'APPROVED' ||
            !v.contribution.acceptingNew ||
            v.contribution.capacity - v.contribution.reserved < v.quantity,
        ))
    )
      throw AppError.conflict(
        'Gói chưa đủ giá, quyền lợi hoặc hạn mức voucher để mở bán',
      );
    return prisma.subscriptionPlan.update({
      where: { id },
      data: { published, isActive: published },
    });
  },
  async contribute(agencyId: string, input: ContributionInput) {
    const tours = await prisma.tour.count({
      where: { id: { in: input.tourIds }, agencyId },
    });
    if (tours !== new Set(input.tourIds).size)
      throw AppError.notFound('Tour không thuộc Agency');
    const { acceptedTerms: _acceptedTerms, ...terms } = input;
    return prisma.premiumContribution.create({ data: { ...terms, agencyId } });
  },
  contributions(agencyId?: string) {
    return prisma.premiumContribution.findMany({
      where: agencyId ? { agencyId } : {},
      orderBy: { createdAt: 'desc' },
    });
  },
  async decideContribution(id: string, status: 'APPROVED' | 'REJECTED') {
    return prisma.premiumContribution.update({
      where: { id, status: 'PENDING' },
      data: { status },
    });
  },
  async stopContribution(id: string, agencyId: string) {
    const changed = await prisma.premiumContribution.updateMany({
      where: { id, agencyId },
      data: { acceptingNew: false },
    });
    if (!changed.count) throw AppError.notFound();
  },
  async pending(
    userId: string,
    role: 'TRAVELER' | 'TOUR_GUIDE',
    planId: string,
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
      const subscriber = await tx.user.findUnique({
        where: { id: userId },
        select: { role: true, status: true },
      });
      if (subscriber?.role !== role || subscriber.status !== 'ACTIVE')
        throw AppError.forbidden(
          'Vai trò hoặc trạng thái tài khoản đã thay đổi',
        );
      const plan = await tx.subscriptionPlan.findUnique({
        where: {
          id: planId,
          isPremium: true,
          audience: role,
          isActive: true,
          published: true,
        },
        include: { premiumVouchers: { include: { contribution: true } } },
      });
      if (!plan)
        throw AppError.notFound('Gói không được mở bán cho tài khoản này');
      const existing = await tx.subscription.findFirst({
        where: { userId, planId, status: 'PENDING_PAYMENT', revokedAt: null },
      });
      if (existing) {
        if (existing.createdAt.getTime() + 30 * 60_000 <= Date.now())
          throw AppError.conflict(
            'Phiên cũ đã hết thời gian; vui lòng kiểm tra thanh toán và thử lại sau khi đối soát',
          );
        return existing;
      }
      const expiresAt = new Date(Date.now() + 30 * 60_000);
      const sub = await tx.subscription.create({
        data: {
          userId,
          planId,
          planCode: plan.code,
          planName: plan.name,
          price: plan.price,
          durationDays: plan.durationDays,
          audience: role,
          isPremium: true,
          planVersion: plan.version,
          entitlementSnapshot: {
            benefits: plan.benefits,
            guide: role === 'TOUR_GUIDE',
          },
        },
      });
      // Lock sources in a stable order; reserve capacity atomically even across different plans.
      for (const v of [...plan.premiumVouchers].sort((a, b) =>
        a.contributionId.localeCompare(b.contributionId),
      )) {
        const c = v.contribution;
        const result =
          await tx.$executeRaw`UPDATE "PremiumContribution" SET reserved = reserved + ${v.quantity} WHERE id = ${c.id}::uuid AND status = 'APPROVED' AND "acceptingNew" = true AND reserved + ${v.quantity} <= capacity`;
        if (!result)
          throw AppError.conflict(
            'Nguồn voucher không còn đủ hạn mức; vui lòng chọn gói khác',
          );
        const terms: VoucherTerms = {
          title: c.title,
          agencyId: c.agencyId,
          tourIds: c.tourIds,
          discountType: c.discountType,
          discountValue: c.discountValue,
          maxDiscountAmount: c.maxDiscountAmount,
          minOrderAmount: c.minOrderAmount,
        };
        await tx.premiumReservation.create({
          data: {
            subscriptionId: sub.id,
            contributionId: c.id,
            quantity: v.quantity,
            terms: json(terms),
            expiresAt,
          },
        });
      }
      return sub;
    });
  },
  async activate(subscriptionId: string, userId: string, now = new Date()) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
      const s = await tx.subscription.findUnique({
        where: { id: subscriptionId, userId, isPremium: true },
        include: { premiumReservations: true },
      });
      if (!s) throw AppError.notFound();
      if (s.revokedAt || s.status === 'ACTIVE' || s.status === 'EXPIRED')
        return false;
      // Released checkout capacity cannot be stolen from already sold subscriptions by a late payment.
      if (s.premiumReservations.some((r) => r.state === 'RELEASED')) {
        await tx.subscription.update({
          where: { id: s.id },
          data: { revokedAt: now, status: 'CANCELLED' },
        });
        await tx.premiumRefund.upsert({
          where: { subscriptionId: s.id },
          create: {
            subscriptionId: s.id,
            userId,
            amount: s.price,
            reason: 'Thanh toán đến sau khi hạn mức đã được giải phóng',
            status: 'APPROVED',
          },
          update: {},
        });
        return false;
      }
      const last = await tx.subscription.findFirst({
        where: {
          userId,
          audience: s.audience,
          isPremium: true,
          status: 'ACTIVE',
          revokedAt: null,
          endsAt: { gt: now },
        },
        orderBy: { endsAt: 'desc' },
      });
      const startsAt = last?.endsAt && last.endsAt > now ? last.endsAt : now;
      await tx.subscription.update({
        where: { id: s.id },
        data: {
          status: 'ACTIVE',
          startsAt,
          endsAt: new Date(startsAt.getTime() + s.durationDays * DAY),
        },
      });
      await tx.premiumReservation.updateMany({
        where: { subscriptionId: s.id, state: 'HELD' },
        data: { state: 'COMMITTED' },
      });
      return true;
    });
  },
  async grantDue(now = new Date(), userId?: string) {
    const due = await prisma.subscription.findMany({
      where: {
        ...(userId ? { userId } : {}),
        isPremium: true,
        status: 'ACTIVE',
        revokedAt: null,
        startsAt: { lte: now },
        endsAt: { gt: now },
        benefitsGrantedAt: null,
      },
      take: 100,
    });
    for (const s of due)
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${s.userId}::uuid FOR UPDATE`;
        const current = await tx.subscription.findUnique({
          where: { id: s.id },
          include: { premiumReservations: true },
        });
        if (!current || current.revokedAt || current.benefitsGrantedAt) return;
        for (const r of current.premiumReservations.filter(
          (r) => r.state === 'COMMITTED',
        )) {
          await tx.premiumVoucher.createMany({
            data: Array.from({ length: r.quantity }, (_, ordinal) => ({
              subscriptionId: s.id,
              userId: s.userId,
              contributionId: r.contributionId,
              ordinal,
              terms: json(r.terms),
              startsAt: s.startsAt!,
              endsAt: s.endsAt!,
            })),
            skipDuplicates: true,
          });
        }
        await tx.subscription.update({
          where: { id: s.id },
          data: { benefitsGrantedAt: now },
        });
      });
    return due.length;
  },
  async releaseExpiredHolds(now = new Date()) {
    const due = await prisma.premiumReservation.findMany({
      where: { state: 'HELD', expiresAt: { lte: now } },
      take: 100,
    });
    for (const r of due)
      await prisma.$transaction(async (tx) => {
        const subscription = await tx.subscription.findUniqueOrThrow({
          where: { id: r.subscriptionId },
        });
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${subscription.userId}::uuid FOR UPDATE`;
        // Let the payment reconciler settle or expire the link before releasing its inventory.
        const payment = await tx.payment.findFirst({
          where: {
            referenceId: r.subscriptionId,
            purpose: 'SUBSCRIPTION',
            status: { in: ['PAID', 'PENDING'] },
          },
        });
        if (payment) return;
        const won = await tx.premiumReservation.updateMany({
          where: { id: r.id, state: 'HELD' },
          data: { state: 'RELEASED' },
        });
        if (won.count) {
          await tx.premiumContribution.update({
            where: { id: r.contributionId },
            data: { reserved: { decrement: r.quantity } },
          });
          await tx.subscription.updateMany({
            where: { id: r.subscriptionId, status: 'PENDING_PAYMENT' },
            data: { status: 'CANCELLED' },
          });
        }
      });
    // Compensate abandoned voucher leases only when no persisted booking owns the lease.
    const stale = await prisma.premiumVoucher.findMany({
      where: {
        bookingId: null,
        heldAt: { lt: new Date(now.getTime() - 60 * 60_000) },
      },
      take: 100,
    });
    for (const v of stale)
      await prisma.premiumVoucher.updateMany({
        where: { id: v.id, bookingId: null, leaseToken: v.leaseToken },
        data: { heldAt: null, leaseToken: null },
      });
    const cancelled = await prisma.$queryRaw<
      { id: string }[]
    >`SELECT b.id FROM "Booking" b JOIN "PremiumVoucher" v ON v."bookingId" = b.id WHERE b.status = 'CANCELLED' LIMIT 100`;
    if (cancelled.length)
      await prisma.premiumVoucher.updateMany({
        where: { bookingId: { in: cancelled.map((b) => b.id) } },
        data: { bookingId: null, heldAt: null, leaseToken: null },
      });
    return due.length;
  },
  async history(userId: string, page = 1, limit = 20) {
    const [items, total] = await Promise.all([
      prisma.subscription.findMany({
        where: { userId, isPremium: true },
        include: { premiumRefund: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.subscription.count({ where: { userId, isPremium: true } }),
    ]);
    return { items, total };
  },
  vouchers(userId: string) {
    return prisma.premiumVoucher.findMany({
      where: { userId },
      orderBy: [{ endsAt: 'desc' }, { id: 'asc' }],
      take: 500,
    });
  },
  async reserveVoucher(
    id: string,
    userId: string,
    agencyId: string,
    tourId: string,
    subtotal: number,
  ) {
    const voucher = await prisma.premiumVoucher.findFirst({
      where: {
        id,
        userId,
        startsAt: { lte: new Date() },
        endsAt: { gt: new Date() },
        subscription: { revokedAt: null, status: 'ACTIVE' },
      },
    });
    if (!voucher) throw AppError.notFound('Voucher không khả dụng');
    const discountAmount = premiumDiscount(
      voucher.terms as unknown as VoucherTerms,
      agencyId,
      tourId,
      subtotal,
    );
    const token = randomUUID();
    const changed = await prisma.premiumVoucher.updateMany({
      where: {
        id,
        userId,
        heldAt: null,
        bookingId: null,
        endsAt: { gt: new Date() },
      },
      data: { heldAt: new Date(), leaseToken: token },
    });
    if (!changed.count)
      throw AppError.conflict(
        'Voucher đã được sử dụng hoặc đang giữ cho đơn khác',
      );
    return { id, token, discountAmount };
  },
  async releaseVoucher(id: string, token: string) {
    await prisma.premiumVoucher.updateMany({
      where: { id, leaseToken: token, bookingId: null },
      data: { heldAt: null, leaseToken: null },
    });
  },
  async releaseBookingVoucher(bookingId: string) {
    await prisma.premiumVoucher.updateMany({
      where: { bookingId },
      data: { bookingId: null, heldAt: null, leaseToken: null },
    });
  },
  async requestRefund(userId: string, subscriptionId: string, reason: string) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
      const s = await tx.subscription.findUnique({
        where: {
          id: subscriptionId,
          userId,
          isPremium: true,
          status: 'ACTIVE',
        },
      });
      if (!s) throw AppError.notFound();
      assertRefundable(s);
      return tx.premiumRefund.upsert({
        where: { subscriptionId },
        create: { userId, subscriptionId, reason, amount: s.price },
        update: {},
      });
    });
  },
  refunds() {
    return prisma.premiumRefund.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  },
  async decideRefund(
    id: string,
    actorId: string,
    action: 'APPROVE' | 'REJECT' | 'COMPLETE',
    note: string,
    transferReference?: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const refund = await tx.premiumRefund.findUniqueOrThrow({
        where: { id },
        include: { subscription: true },
      });
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${refund.userId}::uuid FOR UPDATE`;
      const current = await tx.premiumRefund.findUniqueOrThrow({
        where: { id },
      });
      if (action === 'COMPLETE' && current.status === 'COMPLETED')
        return current;
      if (current.status !== (action === 'COMPLETE' ? 'APPROVED' : 'REQUESTED'))
        throw AppError.conflict('Yêu cầu đã được xử lý');
      if (action === 'APPROVE') {
        const s = await tx.subscription.findUniqueOrThrow({
          where: { id: refund.subscriptionId },
        });
        assertRefundable(s);
        await tx.subscription.update({
          where: { id: s.id },
          data: { revokedAt: new Date(), status: 'CANCELLED' },
        });
        const reservations = await tx.premiumReservation.findMany({
          where: { subscriptionId: s.id, state: 'COMMITTED' },
        });
        for (const r of reservations.sort((a, b) =>
          a.contributionId.localeCompare(b.contributionId),
        )) {
          await tx.premiumReservation.update({
            where: { id: r.id },
            data: { state: 'RELEASED' },
          });
          await tx.premiumContribution.update({
            where: { id: r.contributionId },
            data: { reserved: { decrement: r.quantity } },
          });
        }
      }
      return tx.premiumRefund.update({
        where: { id },
        data: {
          status:
            action === 'APPROVE'
              ? 'APPROVED'
              : action === 'REJECT'
                ? 'REJECTED'
                : 'COMPLETED',
          reviewedBy: actorId,
          decisionNote: note,
          ...(action === 'COMPLETE' ? { transferReference } : {}),
        },
      });
    });
  },
  guideProfile(userId: string) {
    return prisma.premiumGuideProfile.findUnique({ where: { userId } });
  },
  async operations() {
    const [unfulfilled, overdueHolds, pendingRefunds] = await Promise.all([
      prisma.payment.findMany({
        where: { purpose: 'SUBSCRIPTION', status: 'PAID', fulfilledAt: null },
        select: { id: true, referenceId: true, amount: true, paidAt: true },
        orderBy: { paidAt: 'asc' },
        take: 100,
      }),
      prisma.premiumReservation.count({
        where: {
          state: 'HELD',
          expiresAt: { lt: new Date(Date.now() - 10 * 60_000) },
        },
      }),
      prisma.premiumRefund.count({
        where: { status: { in: ['REQUESTED', 'APPROVED'] } },
      }),
    ]);
    return { unfulfilled, overdueHolds, pendingRefunds };
  },
  saveGuideProfile(userId: string, input: GuideProfileInput) {
    return prisma.premiumGuideProfile.upsert({
      where: { userId },
      create: {
        userId,
        ...input,
        portfolio: json(input.portfolio),
        certificates: json(input.certificates),
      },
      update: {
        ...input,
        portfolio: json(input.portfolio),
        certificates: json(input.certificates),
      },
    });
  },
  async analytics(userId: string) {
    const [months, tours, activity, counts] = await Promise.all([
      earningsRepository.summarize(userId, {}),
      prisma.tourGuideAssignment.findMany({
        where: { guideId: userId },
        include: {
          tour: { select: { id: true, title: true, updatedAt: true } },
        },
        orderBy: { tourId: 'asc' },
        take: 100,
      }),
      prisma.premiumGuideActivity.findMany({
        where: { userId },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: 200,
      }),
      prisma.tourGuideAssignment.groupBy({
        by: ['status'],
        where: { guideId: userId },
        _count: true,
      }),
    ]);
    return {
      byMonth: months.map((m) => ({
        month: m.month,
        amount: m.totalAmount,
        count: m.count,
      })),
      assignments: tours,
      activity,
      assignmentCounts: Object.fromEntries(
        counts.map((c) => [c.status, c._count]),
      ),
    };
  },
};
