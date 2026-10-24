import { DISCOUNT_TYPE, PROMOTION_SCOPE } from '@travel-platform/constants';
import { AppError } from '../../utils/app-error';
import type { PromotionRecord } from './promotions.repository';

type PromotionLike = Pick<
  PromotionRecord,
  | 'scope' | 'ownerId' | 'discountType' | 'discountValue' | 'maxDiscountAmount' | 'minOrderAmount'
  | 'startsAt' | 'endsAt' | 'usageLimit' | 'usedCount' | 'isActive'
> &
  Partial<
    Pick<
      PromotionRecord,
      'minParticipants' | 'daysInAdvance' | 'firstBookingOnly' | 'targetTourIds' | 'usageLimitPerUser' | 'applyType' | 'codeType'
    >
  >;

export interface PromotionApplicableContext {
  agencyId: string;
  tourId?: string;
  subtotal: number;
  participants?: number;
  departureDate?: Date;
  isFirstBooking?: boolean;
  userUsedCount?: number;
  now?: Date;
}

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
 * Throws a 409 with a precise code unless `promotion` may be used for an order.
 */
export function assertApplicable(promotion: PromotionLike, ctx: PromotionApplicableContext): void {
  const now = ctx.now ?? new Date();
  if (!promotion.isActive) throw AppError.conflict('This promotion is not active', 'PROMOTION_INACTIVE');
  if (now < promotion.startsAt) throw AppError.conflict('This promotion has not started yet', 'PROMOTION_NOT_STARTED');
  if (now > promotion.endsAt) throw AppError.conflict('This promotion has expired', 'PROMOTION_EXPIRED');
  if (promotion.scope === PROMOTION_SCOPE.AGENCY && promotion.ownerId !== ctx.agencyId) {
    throw AppError.conflict('This promotion does not apply to this tour', 'PROMOTION_NOT_APPLICABLE');
  }
  if (promotion.targetTourIds && promotion.targetTourIds.length > 0 && ctx.tourId) {
    if (!promotion.targetTourIds.includes(ctx.tourId)) {
      throw AppError.conflict('This promotion does not apply to this specific tour', 'PROMOTION_TOUR_NOT_ELIGIBLE');
    }
  }
  if (ctx.subtotal < (promotion.minOrderAmount ?? 0)) {
    throw AppError.conflict(`Minimum order for this promotion is ${promotion.minOrderAmount} VND`, 'PROMOTION_MIN_ORDER');
  }
  if (promotion.minParticipants != null && ctx.participants != null && ctx.participants < promotion.minParticipants) {
    throw AppError.conflict(`Minimum group size for this promotion is ${promotion.minParticipants} participants`, 'PROMOTION_MIN_PARTICIPANTS');
  }
  if (promotion.daysInAdvance != null && ctx.departureDate != null) {
    const advanceDays = Math.floor((ctx.departureDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (advanceDays < promotion.daysInAdvance) {
      throw AppError.conflict(`Must book at least ${promotion.daysInAdvance} days before departure`, 'PROMOTION_EARLY_BIRD');
    }
  }
  if (promotion.firstBookingOnly && ctx.isFirstBooking === false) {
    throw AppError.conflict('This promotion is reserved for first-time bookings only', 'PROMOTION_FIRST_BOOKING_ONLY');
  }
  if (promotion.usageLimit != null && promotion.usedCount >= promotion.usageLimit) {
    throw AppError.conflict('This promotion has been fully redeemed', 'PROMOTION_EXHAUSTED');
  }
  if (promotion.usageLimitPerUser != null && ctx.userUsedCount != null && ctx.userUsedCount >= promotion.usageLimitPerUser) {
    throw AppError.conflict(`You have reached the limit of ${promotion.usageLimitPerUser} redemption(s) for this promotion`, 'PROMOTION_USER_LIMIT_REACHED');
  }
}

/** Non-throwing check for auto-apply candidate selection. */
export function isApplicable(promotion: PromotionLike, ctx: PromotionApplicableContext): boolean {
  try {
    assertApplicable(promotion, ctx);
    return true;
  } catch {
    return false;
  }
}
