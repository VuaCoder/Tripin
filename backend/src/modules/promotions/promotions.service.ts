import { DISCOUNT_TYPE, PROMOTION_SCOPE, type PersistedRole, type PromotionScope } from '@travel-platform/constants';
import { AppError } from '../../utils/app-error';
import { buildPage, type Page } from '../../utils/pagination';
import { AUDIT_ACTIONS, auditService, type AuditService } from '../audit';
import { toursService, type ToursService } from '../tours';
import type { PromotionAttributes, PromotionDocument } from './promotions.model';
import { toPromotionDto } from './promotions.mapper';
import { assertApplicable, computeDiscount } from './promotions.policy';
import { promotionsRepository, type PromotionsRepository } from './promotions.repository';
import type {
  AppliedPromotion,
  CreatePromotionInput,
  ListPromotionsQuery,
  PromotionDto,
  UpdatePromotionInput,
} from './promotions.types';

type Actor = { userId: string; role: PersistedRole };
type Repo = Pick<PromotionsRepository, 'create' | 'findById' | 'findByCode' | 'updateById' | 'list' | 'consume' | 'release'>;

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

  // ------------------------------------------------- Used by bookings

  /** Dry run for the checkout screen: validates the code for this tour/subtotal without consuming a redemption. */
  async preview(code: string, tourId: string, subtotal: number): Promise<AppliedPromotion & { finalAmount: number }> {
    const { promotion, agencyId } = await this.resolve(code, tourId);
    assertApplicable(promotion, { agencyId, subtotal });
    const discountAmount = computeDiscount(promotion, subtotal);
    return this.toApplied(promotion, discountAmount, subtotal);
  }

  /**
   * Validates AND takes one redemption atomically. Call it when the booking is created; call `release` if the booking
   * is cancelled or fails afterwards.
   */
  async redeem(code: string, tourId: string, subtotal: number): Promise<AppliedPromotion> {
    const { promotion, agencyId } = await this.resolve(code, tourId);
    assertApplicable(promotion, { agencyId, subtotal });
    if (!(await this.promotions.consume(promotion.id))) {
      throw AppError.conflict('This promotion has been fully redeemed', 'PROMOTION_EXHAUSTED');
    }
    const { finalAmount: _ignored, ...applied } = this.toApplied(promotion, computeDiscount(promotion, subtotal), subtotal);
    return applied;
  }

  release(promotionId: string): Promise<void> {
    return this.promotions.release(promotionId);
  }

  // ----------------------------------------------------------------- helpers

  private async create(scope: PromotionScope, actor: Actor, input: CreatePromotionInput): Promise<PromotionDto> {
    this.assertTerms(input.discountType, input.discountValue, input.startsAt, input.endsAt);
    if (input.endsAt.getTime() <= Date.now()) throw AppError.badRequest('endsAt must be in the future');
    if (input.discountType === DISCOUNT_TYPE.FIXED && input.maxDiscountAmount !== undefined) {
      throw AppError.badRequest('maxDiscountAmount only applies to PERCENT promotions');
    }
    if (await this.promotions.findByCode(input.code)) {
      throw AppError.conflict('This promotion code is already in use', 'PROMOTION_CODE_EXISTS');
    }
    const created = await this.promotions.create({
      ...input,
      scope,
      ownerId: scope === PROMOTION_SCOPE.AGENCY ? (actor.userId as never) : undefined,
      createdBy: actor.userId as never,
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
      current.discountType as never,
      input.discountValue ?? current.discountValue,
      input.startsAt ?? current.startsAt,
      input.endsAt ?? current.endsAt,
    );

    const updated = await this.promotions.updateById(id, { $set: { ...input } } as never);
    await this.auditPlatform(scope, actor, id, { change: 'updated', fields: Object.keys(input) });
    return toPromotionDto(updated ?? current);
  }

  private async list(
    filter: { scope: PromotionScope; ownerId?: string },
    query: ListPromotionsQuery,
  ): Promise<Page<PromotionDto>> {
    const { items, total } = await this.promotions.list({ ...filter, isActive: query.isActive }, query);
    return buildPage(items.map(toPromotionDto), total, query);
  }

  /** 404 when the promotion is missing, of another scope, or (agency scope) owned by someone else. */
  private async requireScoped(id: string, scope: PromotionScope, ownerId?: string): Promise<PromotionDocument> {
    const promotion = await this.promotions.findById(id);
    if (!promotion || promotion.scope !== scope || (ownerId !== undefined && String(promotion.ownerId) !== ownerId)) {
      throw AppError.notFound('Promotion not found');
    }
    return promotion;
  }

  private async resolve(code: string, tourId: string): Promise<{ promotion: PromotionDocument; agencyId: string }> {
    const promotion = await this.promotions.findByCode(code);
    if (!promotion) throw AppError.notFound('Promotion code not found');
    const tour = await this.tours.getTourFacts(tourId);
    if (!tour) throw AppError.notFound('Tour not found');
    return { promotion, agencyId: tour.agencyId };
  }

  private assertTerms(type: PromotionAttributes['discountType'], value: number, startsAt: Date, endsAt: Date): void {
    if (endsAt.getTime() <= startsAt.getTime()) throw AppError.badRequest('endsAt must be after startsAt');
    if (type === DISCOUNT_TYPE.PERCENT && (value < 1 || value > 100)) {
      throw AppError.badRequest('A PERCENT discount must be between 1 and 100');
    }
  }

  private toApplied(promotion: PromotionDocument, discountAmount: number, subtotal: number) {
    return {
      promotionId: promotion.id,
      code: promotion.code,
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
