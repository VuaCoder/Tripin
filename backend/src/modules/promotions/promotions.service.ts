import { DISCOUNT_TYPE, PROMOTION_APPLY_TYPE, PROMOTION_CODE_TYPE, PROMOTION_SCOPE, type PersistedRole, type PromotionScope } from '@travel-platform/constants';
import { AppError } from '../../utils/app-error';
import type { DbExecutor } from '../../config/database';
import { buildPage, type Page, type PageRequest } from '../../utils/pagination';
import { TtlCache } from '../../utils/ttl-cache';
import { publishPublicEvent } from '../realtime/public-events';
import { AUDIT_ACTIONS, auditService, type AuditService } from '../audit';
import { toursService, type ToursService } from '../tours';
import { notificationsService, type NotificationsService, NOTIFICATION_TYPE } from '../notifications';
import { usersService, type UsersService } from '../users';
import type { FreeTimeSlot } from '../users/users.types';
import type { PromotionCodeInstanceRecord, PromotionRecord } from './promotions.repository';
import { toPromotionDto } from './promotions.mapper';
import { assertApplicable, computeDiscount, isApplicable } from './promotions.policy';
import { promotionsRepository, type PromotionsRepository } from './promotions.repository';
import type {
  AppliedPromotion,
  CreatePromotionInput,
  ListPromotionsQuery,
  PromotionCodeInstanceDto,
  PromotionDto,
  UpdatePromotionInput,
  UserVoucherDto,
} from './promotions.types';

type Actor = { userId: string; role: PersistedRole };
type Repo = Pick<
  PromotionsRepository,
  | 'create'
  | 'findById'
  | 'findByCode'
  | 'updateById'
  | 'list'
  | 'consume'
  | 'release'
  | 'lockPromotions'
  | 'findUsedCodesByBooking'
  | 'findRedemptionsByBooking'
  | 'isUniqueBatch'
  | 'createCodeInstances'
  | 'listCodeInstances'
  | 'consumeCodeInstance'
  | 'releaseCodeInstance'
  | 'collectUserVoucher'
  | 'listUserVouchers'
  | 'countUserUsages'
  | 'findExpiringUserVouchers'
>;

export class PromotionsService {
  private readonly hotCache = new TtlCache<PromotionDto[]>(30_000, 10);
  constructor(
    private readonly promotions: Repo = promotionsRepository,
    private readonly tours: Pick<ToursService, 'getTourFacts'> = toursService,
    private readonly audit: Pick<AuditService, 'record'> = auditService,
    private readonly notifications: Pick<NotificationsService, 'notify' | 'hasRecentVoucherAlert'> = notificationsService,
    private readonly users: Pick<UsersService, 'getPreferences'> = usersService,
  ) {}

  // ------------------------------------------------ Agency: Upload promotions

  createForAgency(agency: Actor, input: CreatePromotionInput): Promise<PromotionDto> {
    return this.create(PROMOTION_SCOPE.AGENCY, agency, input);
  }

  listForAgency(agencyId: string, query: ListPromotionsQuery): Promise<Page<PromotionDto>> {
    return this.list({ scope: PROMOTION_SCOPE.AGENCY, ownerId: agencyId }, query);
  }

  async getForAgency(agencyId: string, id: string): Promise<PromotionDto> {
    return toPromotionDto(await this.requireScoped(id, PROMOTION_SCOPE.AGENCY, agencyId));
  }

  updateForAgency(agency: Actor, id: string, input: UpdatePromotionInput): Promise<PromotionDto> {
    return this.update(PROMOTION_SCOPE.AGENCY, agency, id, input);
  }

  // ------------------------------------- Super admin: Config platform promotions

  createForPlatform(admin: Actor, input: CreatePromotionInput): Promise<PromotionDto> {
    return this.create(PROMOTION_SCOPE.PLATFORM, admin, input);
  }

  listForPlatform(query: ListPromotionsQuery): Promise<Page<PromotionDto>> {
    return this.list({ scope: PROMOTION_SCOPE.PLATFORM }, query);
  }

  getForPlatform(id: string): Promise<PromotionDto> {
    return this.requireScoped(id, PROMOTION_SCOPE.PLATFORM).then(toPromotionDto);
  }

  updateForPlatform(admin: Actor, id: string, input: UpdatePromotionInput): Promise<PromotionDto> {
    return this.update(PROMOTION_SCOPE.PLATFORM, admin, id, input);
  }

  // ------------------------------------------------- Unique code batch generation

  async generateCodeBatch(actor: Actor, promotionId: string, count: number, prefix = 'TRIP'): Promise<string[]> {
    const promotion = await this.promotions.findById(promotionId);
    if (!promotion) throw AppError.notFound('Promotion not found');
    if (promotion.scope === PROMOTION_SCOPE.AGENCY && promotion.ownerId !== actor.userId) {
      throw AppError.forbidden('Cannot manage promotions of another agency');
    }
    const cleanPrefix = prefix.replace(/[^A-Z0-9]/gi, '').toUpperCase() || 'TRIP';
    const codes = new Set<string>();
    while (codes.size < count) {
      const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
      codes.add(`${cleanPrefix}-${randomPart}`);
    }
    const codeList = Array.from(codes);
    await this.promotions.createCodeInstances(promotionId, codeList);
    return codeList;
  }

  async listCodeInstances(actor: Actor, promotionId: string, page: PageRequest): Promise<Page<PromotionCodeInstanceDto>> {
    const promotion = await this.promotions.findById(promotionId);
    if (!promotion) throw AppError.notFound('Promotion not found');
    if (promotion.scope === PROMOTION_SCOPE.AGENCY && promotion.ownerId !== actor.userId && actor.role !== 'SUPER_ADMIN') {
      throw AppError.forbidden('Cannot view promotions of another agency');
    }
    const { items, total } = await this.promotions.listCodeInstances(promotionId, page);
    return buildPage(
      items.map((i) => ({
        id: i.id,
        promotionId: i.promotionId,
        code: i.code,
        isUsed: i.isUsed,
        usedById: i.usedById ?? undefined,
        usedAt: i.usedAt?.toISOString(),
        bookingId: i.bookingId ?? undefined,
        createdAt: i.createdAt.toISOString(),
      })),
      total,
      page,
    );
  }

  // ------------------------------------------------- User vouchers (Collectable)

  async collectVoucher(userId: string, promotionId: string): Promise<UserVoucherDto> {
    const promotion = await this.promotions.findById(promotionId);
    if (!promotion || !promotion.isActive) throw AppError.notFound('Promotion not available');
    const record = await this.promotions.collectUserVoucher(userId, promotionId);
    await this.notifications.notify(userId, {
      type: NOTIFICATION_TYPE.VOUCHER_COLLECTED,
      title: 'Đã lưu voucher vào ví',
      body: `Voucher "${promotion.title}" đã được lưu vào ví ưu đãi của bạn.`,
      data: { promotionId: promotion.id, voucherId: record.id },
    }).catch(() => undefined);
    return {
      id: record.id,
      userId: record.userId,
      promotionId: record.promotionId,
      collectedAt: record.collectedAt.toISOString(),
      isUsed: record.isUsed,
      usedAt: record.usedAt?.toISOString(),
      bookingId: record.bookingId ?? undefined,
      promotion: record.promotion ? toPromotionDto(record.promotion) : undefined,
    };
  }

  /**
   * Sweeps vouchers expiring within the next 48 hours.
   * Dispatches notifications to users whose current local time matches their free-time slots,
   * or triggers urgent alerts if less than 3 hours remain.
   */
  async sweepExpiringVouchers(now = new Date()): Promise<number> {
    const expiring = await this.promotions.findExpiringUserVouchers(48, now);
    if (!expiring.length) return 0;

    let dispatchedCount = 0;

    for (const voucher of expiring) {
      if (!voucher.promotion) continue;
      const { userId, promotion } = voucher;

      try {
        const preferences = await this.users.getPreferences(userId);
        if (preferences.voucherExpiryAlerts === false) continue;

        const remainingMs = promotion.endsAt.getTime() - now.getTime();
        const remainingHours = remainingMs / (1000 * 60 * 60);
        if (remainingHours <= 0) continue;

        const isUrgent = remainingHours <= 3;
        const isInFreeTimeSlot = this.isTimeInFreeSlots(preferences.freeTimeSlots, now);

        // If not urgent and not in free-time slot, skip until their next leisure slot
        if (!isUrgent && !isInFreeTimeSlot) {
          continue;
        }

        const notifType = isUrgent
          ? NOTIFICATION_TYPE.VOUCHER_EXPIRING_URGENT
          : NOTIFICATION_TYPE.VOUCHER_EXPIRING_SOON;

        // Idempotency: check if we already notified this user for this voucher recently (within 12h)
        const alreadySent = await this.notifications.hasRecentVoucherAlert(
          userId,
          voucher.id,
          new Date(now.getTime() - 12 * 60 * 60 * 1000),
        );
        if (alreadySent) continue;

        const discountText =
          promotion.discountType === 'PERCENT'
            ? `${promotion.discountValue}%`
            : `${(promotion.discountValue / 1000).toLocaleString('vi-VN')}k`;

        const title = isUrgent
          ? `Cơ hội cuối! Voucher giảm ${discountText} sắp hết hạn`
          : `Ưu đãi giờ rảnh: Voucher giảm ${discountText} sắp hết hạn`;

        const body = isUrgent
          ? `Voucher "${promotion.title}" chỉ còn chưa đầy 3 giờ hiệu lực. Đặt tour ngay trước khi voucher hết hạn!`
          : `Voucher "${promotion.title}" sắp hết hạn sau ${Math.round(remainingHours)} giờ. Tranh thủ giờ rảnh lên kế hoạch và áp dụng ngay nhé!`;

        await this.notifications.notify(
          userId,
          {
            type: notifType,
            title,
            body,
            data: {
              voucherId: voucher.id,
              promotionId: promotion.id,
              endsAt: promotion.endsAt.toISOString(),
            },
          },
          { email: preferences.emailAlerts },
        );

        dispatchedCount++;
      } catch (err) {
        // Individual notification failure never breaks the sweep loop
      }
    }

    return dispatchedCount;
  }

  private isTimeInFreeSlots(slots: FreeTimeSlot[], now: Date): boolean {
    if (!slots || !slots.length) return false;
    // Vietnam is UTC+7
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const vnTime = new Date(utc + 7 * 3600000);
    const currentMinutes = vnTime.getHours() * 60 + vnTime.getMinutes();

    return slots.some((slot) => {
      if (!slot.enabled) return false;
      const [startH, startM] = slot.start.split(':').map(Number);
      const [endH, endM] = slot.end.split(':').map(Number);
      if (startH === undefined || startM === undefined || endH === undefined || endM === undefined || isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return false;
      const startMin = startH * 60 + startM;
      const endMin = endH * 60 + endM;
      return currentMinutes >= startMin && currentMinutes <= endMin;
    });
  }

  async listUserVouchers(userId: string): Promise<UserVoucherDto[]> {
    const records = await this.promotions.listUserVouchers(userId);
    return records.map((r) => ({
      id: r.id,
      userId: r.userId,
      promotionId: r.promotionId,
      collectedAt: r.collectedAt.toISOString(),
      isUsed: r.isUsed,
      usedAt: r.usedAt?.toISOString(),
      bookingId: r.bookingId ?? undefined,
      promotion: r.promotion ? toPromotionDto(r.promotion) : undefined,
    }));
  }

  // ------------------------------------------------- Used by bookings

  /** Dry run for the checkout screen: validates the code for this tour/subtotal without consuming a redemption. */
  async preview(
    code: string,
    tourId: string,
    subtotal: number,
    opts?: { participants?: number; departureDate?: Date; userId?: string; isFirstBooking?: boolean },
  ): Promise<AppliedPromotion & { finalAmount: number }> {
    const { promotion, agencyId, codeInstance } = await this.resolve(code, tourId);
    if (codeInstance?.isUsed) {
      throw AppError.conflict('This voucher code has already been used', 'PROMOTION_CODE_USED');
    }
    let userUsedCount: number | undefined;
    if (opts?.userId) {
      userUsedCount = await this.promotions.countUserUsages(opts.userId, promotion.id);
    }
    assertApplicable(promotion, {
      agencyId,
      tourId,
      subtotal,
      participants: opts?.participants,
      departureDate: opts?.departureDate,
      isFirstBooking: opts?.isFirstBooking,
      userUsedCount,
    });
    const discountAmount = computeDiscount(promotion, subtotal);
    const applied = this.toApplied(promotion, discountAmount, subtotal);
    return {
      ...applied,
      code: codeInstance ? codeInstance.code : applied.code,
      codeInstanceId: codeInstance?.id,
    };
  }

  /**
   * Takes the instance and quota on the caller's booking transaction. A unique code must never be
   * consumed without its booking/user context. Shared-code callers outside bookings retain their API.
   */
  async redeem(
    code: string,
    tourId: string,
    subtotal: number,
    opts?: { participants?: number; departureDate?: Date; userId?: string; bookingId?: string; isFirstBooking?: boolean; tx?: DbExecutor },
  ): Promise<AppliedPromotion> {
    const { promotion, agencyId, codeInstance } = await this.resolve(code, tourId, opts?.tx);
    if (codeInstance?.isUsed) {
      throw AppError.conflict('This voucher code has already been used', 'PROMOTION_CODE_USED');
    }
    if (codeInstance && (!opts?.bookingId || !opts.userId || !opts.tx)) {
      throw AppError.badRequest('A unique voucher requires a booking, user and transaction');
    }
    let userUsedCount: number | undefined;
    if (opts?.userId) {
      userUsedCount = await this.promotions.countUserUsages(opts.userId, promotion.id, opts.tx);
    }
    assertApplicable(promotion, {
      agencyId,
      tourId,
      subtotal,
      participants: opts?.participants,
      departureDate: opts?.departureDate,
      isFirstBooking: opts?.isFirstBooking,
      userUsedCount,
    });
    if (codeInstance) {
      if (opts?.bookingId && opts.userId && opts.tx) {
        const consumed = await this.promotions.consumeCodeInstance(codeInstance.id, opts.bookingId, opts.userId, opts.tx);
        if (!consumed) throw AppError.conflict('This voucher code has already been used', 'PROMOTION_CODE_USED');
      }
    }
    const consumeResult = opts?.tx ? await this.promotions.consume(promotion.id, opts.userId, opts.tx) : opts?.userId ? await this.promotions.consume(promotion.id, opts.userId) : await this.promotions.consume(promotion.id);
    const consumed = typeof consumeResult === 'boolean' ? { success: consumeResult, reason: 'EXHAUSTED' as const } : consumeResult;
    if (!consumed.success) {
      if (consumed.reason === 'USER_LIMIT_REACHED') {
        throw AppError.conflict(
          `You have reached the limit of ${promotion.usageLimitPerUser ?? 1} redemption(s) for this promotion`,
          'PROMOTION_USER_LIMIT_REACHED',
        );
      }

      throw AppError.conflict('This promotion has been fully redeemed', 'PROMOTION_EXHAUSTED');
    }
    const { finalAmount: _ignored, ...applied } = this.toApplied(promotion, computeDiscount(promotion, subtotal), subtotal);
    return {
      ...applied,
      code: codeInstance ? codeInstance.code : applied.code,
      codeInstanceId: codeInstance?.id,
    };
  }

  async release(promotionId: string): Promise<void> {
    return this.promotions.release(promotionId);
  }

  /** Parent locks serialize conflicting redemptions; sort independently of agency/platform pricing order. */
  async lockForBooking(codes: readonly string[], tx: DbExecutor): Promise<void> {
    const ids: string[] = [];
    for (const code of codes) {
      const found = await this.promotions.findByCode(code, tx);
      if (found) ids.push(found.promotion.id);
    }
    await this.promotions.lockPromotions(ids, tx);
  }

  /** Called only after winning the booking's cancellation CAS, on that same transaction. */
  async releaseForBooking(bookingId: string, primaryPromotionId: string | undefined, tx: DbExecutor): Promise<void> {
    const instances = await this.promotions.findUsedCodesByBooking(bookingId, tx);
    const redemptions = await this.promotions.findRedemptionsByBooking(bookingId, tx);
    await this.promotions.lockPromotions([
      ...instances.map((instance) => instance.promotionId), ...redemptions.map((r) => r.promotionId), ...(primaryPromotionId ? [primaryPromotionId] : []),
    ], tx);
    const handled = new Set<string>();
    for (const instance of instances) {
      handled.add(instance.promotionId);
      if (await this.promotions.releaseCodeInstance(instance.id, bookingId, tx)) {
        await this.promotions.release(instance.promotionId, tx);
      }
    }
    for (const redemption of redemptions) {
      if (!handled.has(redemption.promotionId) && !redemption.codeInstanceId && !(await this.promotions.isUniqueBatch(redemption.promotionId, tx))) {
        await this.promotions.release(redemption.promotionId, tx);
        handled.add(redemption.promotionId);
      }
    }
    // Keep the legacy primary shared-voucher release; never guess ownership of an old unlinked batch code.
    if (primaryPromotionId && !handled.has(primaryPromotionId) && !(await this.promotions.isUniqueBatch(primaryPromotionId, tx))) {
      await this.promotions.release(primaryPromotionId, tx);
    }
  }

  /** Returns active public promotions for the home page (hot / sorted by usage and recency). */
  async listHotPromotions(limit: number = 10): Promise<PromotionDto[]> {
    return this.hotCache.getOrCompute('hot_' + limit, async () => {
    const now = new Date();
    const res = await this.promotions.list(
      {
        isActive: true,
        isArchived: false,
      },
      { page: 1, limit: 50 },
    );
    return res.items
      .filter(
        (p) =>
          p.isActive &&
          !p.isArchived &&
          p.startsAt <= new Date(now.getTime() + 15 * 60 * 1000) &&
          now <= p.endsAt &&
          (p.usageLimit == null || p.usedCount < p.usageLimit) &&
          p.codeType !== PROMOTION_CODE_TYPE.UNIQUE_BATCH,
      )
      .sort((a, b) => b.usedCount - a.usedCount || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
      .map(toPromotionDto);
  
    });
  }

    /** Returns active promotions publicly displayed for an agency storefront (collectable, codes). */
  async listPublicAgencyPromotions(agencyId: string): Promise<PromotionDto[]> {
    const now = new Date();
    const res = await this.promotions.list(
      {
        scope: PROMOTION_SCOPE.AGENCY,
        ownerId: agencyId,
        isActive: true,
        isArchived: false,
      },
      { page: 1, limit: 50 },
    );
    return res.items
      .filter(
        (p) =>
          p.isActive &&
          !p.isArchived &&
          p.startsAt <= new Date(now.getTime() + 15 * 60 * 1000) &&
          now <= p.endsAt &&
          (p.usageLimit == null || p.usedCount < p.usageLimit) &&
          p.codeType !== PROMOTION_CODE_TYPE.UNIQUE_BATCH,
      )
      .map(toPromotionDto);
  }

  /** Returns active promotions for a tour (code, auto, collectable). */
  async listAvailableForTour(
    tourId: string,
    opts?: { subtotal?: number; participants?: number; departureDate?: Date; userId?: string; isFirstBooking?: boolean },
  ): Promise<{
    platform: PromotionDto[];
    agency: PromotionDto[];
    autoPlatform?: AppliedPromotion;
    autoAgency?: AppliedPromotion;
  }> {
    const tour = await this.tours.getTourFacts(tourId);
    if (!tour) throw AppError.notFound('Tour not found');
    const now = new Date();
    const [platformRes, agencyRes] = await Promise.all([
      this.promotions.list({ scope: PROMOTION_SCOPE.PLATFORM, isActive: true, isArchived: false }, { page: 1, limit: 50 }),
      this.promotions.list({ scope: PROMOTION_SCOPE.AGENCY, ownerId: tour.agencyId, isActive: true, isArchived: false }, { page: 1, limit: 50 }),
    ]);
    const filterValid = (items: PromotionRecord[]) =>
      items.filter(
        (p) =>
          p.isActive &&
          !p.isArchived &&
          p.startsAt <= new Date(now.getTime() + 15 * 60 * 1000) &&
          now <= p.endsAt &&
          (p.usageLimit == null || p.usedCount < p.usageLimit) &&
          p.codeType !== PROMOTION_CODE_TYPE.UNIQUE_BATCH,
      );

    const validPlatform = filterValid(platformRes.items);
    const validAgency = filterValid(agencyRes.items);

    let autoAgency: AppliedPromotion | undefined;
    let autoPlatform: AppliedPromotion | undefined;

    if (opts?.subtotal) {
      // Find best auto agency promotion
      let maxAgencyDiscount = 0;
      for (const p of validAgency.filter((x) => x.applyType === PROMOTION_APPLY_TYPE.AUTO_APPLY)) {
        const count = opts.userId ? await this.promotions.countUserUsages(opts.userId, p.id) : 0;
        const valid = isApplicable(p, {
          agencyId: tour.agencyId,
          tourId,
          subtotal: opts.subtotal,
          participants: opts.participants,
          departureDate: opts.departureDate,
          isFirstBooking: opts.isFirstBooking,
          userUsedCount: count,
          now,
        });
        if (valid) {
          const discount = computeDiscount(p, opts.subtotal);
          if (discount > maxAgencyDiscount) {
            maxAgencyDiscount = discount;
            const applied = this.toApplied(p, discount, opts.subtotal);
            autoAgency = { promotionId: applied.promotionId, code: applied.code, scope: applied.scope, discountAmount: applied.discountAmount };
          }
        }
      }

      // Find best auto platform promotion
      const remainingSubtotal = Math.max(0, opts.subtotal - (autoAgency?.discountAmount ?? 0));
      let maxPlatformDiscount = 0;
      for (const p of validPlatform.filter((x) => x.applyType === PROMOTION_APPLY_TYPE.AUTO_APPLY)) {
        const count = opts.userId ? await this.promotions.countUserUsages(opts.userId, p.id) : 0;
        const valid = isApplicable(p, {
          agencyId: tour.agencyId,
          tourId,
          subtotal: remainingSubtotal,
          participants: opts.participants,
          departureDate: opts.departureDate,
          isFirstBooking: opts.isFirstBooking,
          userUsedCount: count,
          now,
        });
        if (valid) {
          const discount = computeDiscount(p, remainingSubtotal);
          if (discount > maxPlatformDiscount) {
            maxPlatformDiscount = discount;
            const applied = this.toApplied(p, discount, remainingSubtotal);
            autoPlatform = { promotionId: applied.promotionId, code: applied.code, scope: applied.scope, discountAmount: applied.discountAmount };
          }
        }
      }
    }

    return {
      platform: validPlatform.map(toPromotionDto),
      agency: validAgency.map(toPromotionDto),
      autoAgency,
      autoPlatform,
    };
  }

  // ----------------------------------------------------------------- helpers

  private async create(scope: PromotionScope, actor: Actor, input: CreatePromotionInput): Promise<PromotionDto> {
    this.assertTerms(input.discountType, input.discountValue, input.startsAt, input.endsAt);
    if (input.endsAt.getTime() <= Date.now()) throw AppError.badRequest('endsAt must be in the future');
    if (input.discountType === DISCOUNT_TYPE.FIXED && input.maxDiscountAmount !== undefined) {
      throw AppError.badRequest('maxDiscountAmount only applies to PERCENT promotions');
    }
    if (input.code) {
      if (await this.promotions.findByCode(input.code)) {
        throw AppError.conflict('This promotion code is already in use', 'PROMOTION_CODE_EXISTS');
      }
    } else if (input.codeType !== PROMOTION_CODE_TYPE.UNIQUE_BATCH) {
      throw AppError.badRequest('Promotion code is required for shared promotions');
    }
    const created = await this.promotions.create({
      ...input,
      applyType: input.applyType ?? PROMOTION_APPLY_TYPE.CODE,
      codeType: input.codeType ?? PROMOTION_CODE_TYPE.SHARED,
      scope,
      ownerId: scope === PROMOTION_SCOPE.AGENCY ? actor.userId : undefined,
      createdById: actor.userId,
    });
    await this.auditPlatform(scope, actor, created.id, { change: 'created', code: created.code });
    this.hotCache.clear();
    if (scope === PROMOTION_SCOPE.PLATFORM) publishPublicEvent('promotion:updated', { id: created.id });
    return toPromotionDto(created);
  }

  private async update(scope: PromotionScope, actor: Actor, id: string, input: UpdatePromotionInput): Promise<PromotionDto> {
    const current = await this.requireScoped(id, scope, scope === PROMOTION_SCOPE.AGENCY ? actor.userId : undefined);

    if (current.usedCount > 0 && input.discountValue !== undefined && input.discountValue !== current.discountValue) {
      throw AppError.conflict('The discount of a promotion that has been used cannot change; create a new one', 'PROMOTION_IN_USE');
    }

    const hasStarted = current.startsAt <= new Date();
    if (hasStarted) {
      const isDiscountModified = input.discountValue !== undefined && input.discountValue !== current.discountValue;
      const isMinOrderModified = input.minOrderAmount !== undefined && input.minOrderAmount !== current.minOrderAmount;
      const isDiscountTypeModified = (input as any).discountType !== undefined && (input as any).discountType !== current.discountType;
      const isStartsAtModified = input.startsAt !== undefined && new Date(input.startsAt).getTime() !== current.startsAt.getTime();

      if (isDiscountModified || isMinOrderModified || isDiscountTypeModified || isStartsAtModified) {
        throw AppError.badRequest(
          'Cannot modify discount value, discount type, min order amount or start date for an active started promotion',
          undefined,
          'PROMOTION_ACTIVE_LOCKED' as any,
        );
      }
    }
    if (input.usageLimit !== undefined && input.usageLimit < current.usedCount) {
      throw AppError.badRequest(`usageLimit cannot be below the ${current.usedCount} redemptions already used`);
    }
    if (input.maxDiscountAmount !== undefined && current.discountType === DISCOUNT_TYPE.FIXED) {
      throw AppError.badRequest('maxDiscountAmount only applies to PERCENT promotions');
    }
    this.assertTerms(
      current.discountType,
      input.discountValue ?? current.discountValue,
      input.startsAt ?? current.startsAt,
      input.endsAt ?? current.endsAt,
    );

    const patchData: UpdatePromotionInput = { ...input };
    if (patchData.isArchived === true && patchData.isActive === undefined) {
      patchData.isActive = false;
    }

    const updated = await this.promotions.updateById(id, patchData);
    await this.auditPlatform(scope, actor, id, { change: 'updated', fields: Object.keys(input) });
    this.hotCache.clear();
    if (scope === PROMOTION_SCOPE.PLATFORM) publishPublicEvent('promotion:updated', { id });
    return toPromotionDto(updated ?? current);
  }

  private async list(
    filter: { scope: PromotionScope; ownerId?: string },
    query: ListPromotionsQuery,
  ): Promise<Page<PromotionDto>> {
    const isArchived = query.isArchived !== undefined ? query.isArchived : false;
    const { items, total } = await this.promotions.list(
      {
        ...filter,
        isActive: query.isActive,
        isArchived,
        q: query.q,
        discountType: query.discountType,
        applyType: query.applyType,
        from: query.from,
        to: query.to,
      },
      query,
    );
    return buildPage(items.map(toPromotionDto), total, query);
  }

  /** 404 when the promotion is missing, of another scope, or (agency scope) owned by someone else. */
  private async requireScoped(id: string, scope: PromotionScope, ownerId?: string): Promise<PromotionRecord> {
    const promotion = await this.promotions.findById(id);
    if (!promotion || promotion.scope !== scope || (ownerId !== undefined && promotion.ownerId !== ownerId)) {
      throw AppError.notFound('Promotion not found');
    }
    return promotion;
  }

  private async resolve(
    code: string,
    tourId: string,
    tx?: DbExecutor,
  ): Promise<{ promotion: PromotionRecord; agencyId: string; codeInstance?: PromotionCodeInstanceRecord }> {
    const raw = (await this.promotions.findByCode(code, tx)) as any;
    if (!raw) throw AppError.notFound('Promotion code not found');
    const promotion: PromotionRecord = raw.promotion ?? raw;
    const codeInstance: PromotionCodeInstanceRecord | undefined = raw.codeInstance;
    if (promotion.isArchived) {
      throw AppError.badRequest('Khuyến mãi này đã được lưu trữ và không còn hiệu lực.', 'PROMOTION_ARCHIVED');
    }
    if (promotion.codeType === PROMOTION_CODE_TYPE.UNIQUE_BATCH && !codeInstance) {
      throw AppError.badRequest(
        'Đây là chương trình phát hành theo lô mã riêng. Vui lòng sử dụng mã cá nhân đã được cấp.',
        'PROMOTION_BATCH_PREFIX_NOT_USABLE',
      );
    }
    const tour = await this.tours.getTourFacts(tourId, tx);
    if (!tour) throw AppError.notFound('Tour not found');
    return { promotion, agencyId: tour.agencyId, codeInstance };
  }

  private assertTerms(type: PromotionRecord['discountType'], value: number, startsAt: Date, endsAt: Date): void {
    if (endsAt.getTime() <= startsAt.getTime()) throw AppError.badRequest('endsAt must be after startsAt');
    if (type === DISCOUNT_TYPE.PERCENT && (value < 1 || value > 100)) {
      throw AppError.badRequest('A PERCENT discount must be between 1 and 100');
    }
  }

  private toApplied(promotion: PromotionRecord, discountAmount: number, subtotal: number) {
    return {
      promotionId: promotion.id,
      code: promotion.code ?? 'PROMO',
      scope: promotion.scope as PromotionScope,
      discountAmount,
      finalAmount: subtotal - discountAmount,
    };
  }

  private async auditPlatform(scope: PromotionScope, actor: Actor, id: string, metadata: Record<string, unknown>) {
    if (scope !== PROMOTION_SCOPE.PLATFORM) return;
    await this.audit.record({
      actorId: actor.userId,
      actorRole: actor.role,
      action: AUDIT_ACTIONS.PROMOTION_PLATFORM_CHANGED,
      targetType: 'promotion',
      targetId: id,
      metadata,
    });
  }
}

export const promotionsService = new PromotionsService();

