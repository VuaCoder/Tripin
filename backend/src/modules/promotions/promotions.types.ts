import type { DiscountType, PromotionScope } from '@travel-platform/constants';

export interface PromotionDto {
  id: string;
  scope: PromotionScope;
  ownerId?: string;
  code: string;
  title: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderAmount: number;
  startsAt: string;
  endsAt: string;
  usageLimit?: number;
  usedCount: number;
  isActive: boolean;
  /** Derived: active and inside its validity window right now. */
  isRunning: boolean;
}

export interface CreatePromotionInput {
  code: string;
  title: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderAmount?: number;
  startsAt: Date;
  endsAt: Date;
  usageLimit?: number;
}

/** `code` and `discountType` are immutable; `discountValue` is locked once the promotion has been used. */
export interface UpdatePromotionInput {
  title?: string;
  description?: string;
  discountValue?: number;
  maxDiscountAmount?: number;
  minOrderAmount?: number;
  startsAt?: Date;
  endsAt?: Date;
  usageLimit?: number;
  isActive?: boolean;
}

export interface ListPromotionsQuery {
  page: number;
  limit: number;
  isActive?: boolean;
}

/** Result of validating a code against an order (what a booking stores as a snapshot). */
export interface AppliedPromotion {
  promotionId: string;
  code: string;
  scope: PromotionScope;
  discountAmount: number;
}
