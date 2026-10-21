import type { DiscountType, PromotionApplyType, PromotionCodeType, PromotionScope } from '@travel-platform/constants';

export interface PromotionDto {
  id: string;
  scope: PromotionScope;
  ownerId?: string;
  applyType: PromotionApplyType;
  codeType: PromotionCodeType;
  code?: string;
  title: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderAmount: number;
  minParticipants?: number;
  daysInAdvance?: number;
  firstBookingOnly: boolean;
  targetTourIds: string[];
  startsAt: string;
  endsAt: string;
  usageLimit?: number;
  usageLimitPerUser: number;
  usedCount: number;
  isActive: boolean;
  /** Derived: active and inside its validity window right now. */
  isRunning: boolean;
}

export interface CreatePromotionInput {
  applyType?: PromotionApplyType;
  codeType?: PromotionCodeType;
  code?: string;
  title: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderAmount?: number;
  minParticipants?: number;
  daysInAdvance?: number;
  firstBookingOnly?: boolean;
  targetTourIds?: string[];
  startsAt: Date;
  endsAt: Date;
  usageLimit?: number;
  usageLimitPerUser?: number;
}

/** `code` and `discountType` are immutable; `discountValue` is locked once the promotion has been used. */
export interface UpdatePromotionInput {
  title?: string;
  description?: string;
  discountValue?: number;
  maxDiscountAmount?: number;
  minOrderAmount?: number;
  minParticipants?: number;
  daysInAdvance?: number;
  firstBookingOnly?: boolean;
  targetTourIds?: string[];
  startsAt?: Date;
  endsAt?: Date;
  usageLimit?: number;
  usageLimitPerUser?: number;
  isActive?: boolean;
}

export interface ListPromotionsQuery {
  q?: string;
  discountType?: DiscountType;
  applyType?: PromotionApplyType;
  from?: Date;
  to?: Date;
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
  codeInstanceId?: string;
}

export interface PromotionCodeInstanceDto {
  id: string;
  promotionId: string;
  code: string;
  isUsed: boolean;
  usedById?: string;
  usedAt?: string;
  bookingId?: string;
  createdAt: string;
}

export interface UserVoucherDto {
  id: string;
  userId: string;
  promotionId: string;
  collectedAt: string;
  isUsed: boolean;
  usedAt?: string;
  bookingId?: string;
  promotion?: PromotionDto;
}
