import { DISCOUNT_TYPE, PROMOTION_APPLY_TYPE, PROMOTION_CODE_TYPE, PROMOTION_SCOPE, type PersistedRole, type PromotionScope } from '@travel-platform/constants';
import { AppError } from '../../utils/app-error';
import { buildPage, type Page, type PageRequest } from '../../utils/pagination';
import { AUDIT_ACTIONS, auditService, type AuditService } from '../audit';
import { toursService, type ToursService } from '../tours';
import type { PromotionCodeInstanceRecord, PromotionRecord, UserVoucherRecord } from './promotions.repository';
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
  | 'createCodeInstances'
  | 'listCodeInstances'
  | 'consumeCodeInstance'
  | 'releaseCodeInstance'
  | 'collectUserVoucher'
  | 'listUserVouchers'
  | 'countUserUsages'
>;

export class PromotionsService {
  constructor(
    private readonly promotions: Repo = promotionsRepository,
    private readonly tours: Pick<ToursService, 'getTourFacts'> = toursService,
    private readonly audit: Pick<AuditService, 'record'> = auditService,
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
    if (promotion.applyType !== PROMOTION_APPLY_TYPE.COLLECTABLE) {
      throw AppError.badRequest('This promotion is not a collectable voucher');
    }
    const record = await this.promotions.collectUserVoucher(userId, promotionId);
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
    if (codeInstance && codeInstance.isUsed) {
      throw AppError.conflict('This voucher code has already been used', 'PROMOTION_CODE_USED');
    }
    const discountAmount = computeDiscount(promotion, subtotal);
    const applied = this.toApplied(promotion, discountAmount, subtotal);
    return {
      ...applied,
      code: codeInstance ? codeInstance.code : applied.code,
      codeInstanceId: codeInstance?.id,
    };
  }

  /**
   * Validates AND takes one redemption atomically. Call it when the booking is created; call `release` if the booking
   * is cancelled or fails afterwards.
   */
  async redeem(
    code: string,
    tourId: string,
    subtotal: number,
    opts?: { participants?: number; departureDate?: Date; userId?: string; bookingId?: string; isFirstBooking?: boolean },
  ): Promise<AppliedPromotion> {
    const { promotion, agencyId, codeInstance } = await this.resolve(code, tourId);
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
    if (codeInstance) {
      if (codeInstance.isUsed) {
        throw AppError.conflict('This voucher code has already been used', 'PROMOTION_CODE_USED');
      }
      if (opts?.bookingId && opts?.userId) {
        const consumed = await this.promotions.consumeCodeInstance(codeInstance.id, opts.bookingId, opts.userId);
        if (!consumed) throw AppError.conflict('This voucher code has already been used', 'PROMOTION_CODE_USED');
      }
    }
    if (!(await this.promotions.consume(promotion.id))) {
      throw AppError.conflict('This promotion has been fully redeemed', 'PROMOTION_EXHAUSTED');
    }
    const { finalAmount: _ignored, ...applied } = this.toApplied(promotion, computeDiscount(promotion, subtotal), subtotal);
    return {
      ...applied,
      code: codeInstance ? codeInstance.code : applied.code,
      codeInstanceId: codeInstance?.id,
    };
  }

  async release(promotionId: string, codeInstanceId?: string): Promise<void> {
    if (codeInstanceId) {
      await this.promotions.releaseCodeInstance(codeInstanceId);
    }
    return this.promotions.release(promotionId);
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
      this.promotions.list({ scope: PROMOTION_SCOPE.PLATFORM, isActive: true }, { page: 1, limit: 50 }),
      this.promotions.list({ scope: PROMOTION_SCOPE.AGENCY, ownerId: tour.agencyId, isActive: true }, { page: 1, limit: 50 }),
    ]);
    const filterValid = (items: PromotionRecord[]) =>
      items.filter((p) => p.isActive && p.startsAt <= now && now <= p.endsAt && (p.usageLimit == null || p.usedCount < p.usageLimit));

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
    return toPromotionDto(created);
  }

  private async update(scope: PromotionScope, actor: Actor, id: string, input: UpdatePromotionInput): Promise<PromotionDto> {
    const current = await this.requireScoped(id, scope, scope === PROMOTION_SCOPE.AGENCY ? actor.userId : undefined);

    if (current.usedCount > 0 && input.discountValue !== undefined && input.discountValue !== current.discountValue) {
      throw AppError.conflict('The discount of a promotion that has been used cannot change; create a new one', 'PROMOTION_IN_USE');
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

    const updated = await this.promotions.updateById(id, { ...input });
    await this.auditPlatform(scope, actor, id, { change: 'updated', fields: Object.keys(input) });
    return toPromotionDto(updated ?? current);
  }

  private async list(
    filter: { scope: PromotionScope; ownerId?: string },
    query: ListPromotionsQuery,
  ): Promise<Page<PromotionDto>> {
    const { items, total } = await this.promotions.list(
      { ...filter, isActive: query.isActive, q: query.q, discountType: query.discountType, applyType: query.applyType, from: query.from, to: query.to },
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
  ): Promise<{ promotion: PromotionRecord; agencyId: string; codeInstance?: PromotionCodeInstanceRecord }> {
    const raw = (await this.promotions.findByCode(code)) as any;
    if (!raw) throw AppError.notFound('Promotion code not found');
    const promotion: PromotionRecord = raw.promotion ?? raw;
    const codeInstance: PromotionCodeInstanceRecord | undefined = raw.codeInstance;
    const tour = await this.tours.getTourFacts(tourId);
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

