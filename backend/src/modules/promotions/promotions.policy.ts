import { DISCOUNT_TYPE, PROMOTION_SCOPE } from '@travel-platform/constants';
import { AppError } from '../../utils/app-error';
import type { PromotionDocument } from './promotions.model';

type PromotionLike = Pick<
  PromotionDocument,
  | 'scope' | 'ownerId' | 'discountType' | 'discountValue' | 'maxDiscountAmount' | 'minOrderAmount'
  | 'startsAt' | 'endsAt' | 'usageLimit' | 'usedCount' | 'isActive'
>;

export function isRunning(promotion: Pick<PromotionLike, 'isActive' | 'startsAt' | 'endsAt'>, now = new Date()): boolean {
  return promotion.isActive && promotion.startsAt <= now && now <= promotion.endsAt;
}

/** Whole VND, never negative, never more than the order. PERCENT is optionally capped by `maxDiscountAmount`. */
export function computeDiscount(promotion: Pick<PromotionLike, 'discountType' | 'discountValue' | 'maxDiscountAmount'>, subtotal: number): number {
  let discount: number;
  if (promotion.discountType === DISCOUNT_TYPE.PERCENT) {
    discount = Math.floor((subtotal * promotion.discountValue) / 100);
    if (promotion.maxDiscountAmount !== undefined && promotion.maxDiscountAmount !== null) {
      discount = Math.min(discount, promotion.maxDiscountAmount);
    }
  } else {
    discount = promotion.discountValue;
  }
  return Math.max(0, Math.min(discount, subtotal));
}

/**
 * Throws a 409 with a precise code unless `promotion` may be used for an order of `subtotal` VND on a tour of `agencyId`.
 * (409, not 404: the code exists but cannot be used for this order.)
 */
export function assertApplicable(promotion: PromotionLike, ctx: { agencyId: string; subtotal: number; now?: Date }): void {
  const now = ctx.now ?? new Date();
  if (!promotion.isActive) throw AppError.conflict('This promotion is not active', 'PROMOTION_INACTIVE');
  if (now < promotion.startsAt) throw AppError.conflict('This promotion has not started yet', 'PROMOTION_NOT_STARTED');
  if (now > promotion.endsAt) throw AppError.conflict('This promotion has expired', 'PROMOTION_EXPIRED');
  if (promotion.scope === PROMOTION_SCOPE.AGENCY && String(promotion.ownerId) !== ctx.agencyId) {
    throw AppError.conflict('This promotion does not apply to this tour', 'PROMOTION_NOT_APPLICABLE');
  }
  if (ctx.subtotal < (promotion.minOrderAmount ?? 0)) {
    throw AppError.conflict(`Minimum order for this promotion is ${promotion.minOrderAmount} VND`, 'PROMOTION_MIN_ORDER');
  }
  if (promotion.usageLimit != null && promotion.usedCount >= promotion.usageLimit) {
    throw AppError.conflict('This promotion has been fully redeemed', 'PROMOTION_EXHAUSTED');
  }
}
