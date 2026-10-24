/** Wire shapes of `/agency/promotions` (`PromotionDto` in the backend `promotions` module). */

export type DiscountType = 'PERCENT' | 'FIXED';
export type PromotionApplyType = 'CODE' | 'AUTO_APPLY' | 'COLLECTABLE';
export type PromotionCodeType = 'SHARED' | 'UNIQUE_BATCH';

export interface PromotionCodeInstance {
  id: string;
  promotionId: string;
  code: string;
  isUsed: boolean;
  usedById?: string;
  usedAt?: string;
  bookingId?: string;
  createdAt: string;
}

export interface AgencyPromotion {
  id: string;
  scope: 'AGENCY' | 'PLATFORM';
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
  firstBookingOnly?: boolean;
  targetTourIds?: string[];
  startsAt: string;
  endsAt: string;
  usageLimit?: number;
  usageLimitPerUser?: number;
  usedCount: number;
  isActive: boolean;
  isArchived: boolean;
  /** Derived by the backend: active and inside its validity window right now. */
  isRunning: boolean;
}

export interface PromotionPageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PromotionListResult {
  items: AgencyPromotion[];
  meta: PromotionPageMeta;
}

export interface PromotionApiResponse<T> {
  success: boolean;
  data: T;
  meta?: PromotionPageMeta;
  error?: { code: string; message: string; details?: unknown };
}

export interface ListPromotionsArgs {
  q?: string;
  discountType?: DiscountType;
  applyType?: PromotionApplyType;
  codeType?: PromotionCodeType;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  isActive?: boolean;
  isArchived?: boolean;
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
  startsAt: string;
  endsAt: string;
  usageLimit?: number;
  usageLimitPerUser?: number;
  isArchived?: boolean;
}

/** `code` and `discountType` are immutable; `discountValue` is locked once `usedCount > 0`. */
export interface UpdatePromotionInput {
  id: string;
  patch: Partial<{
    title: string;
    description: string;
    discountValue: number;
    maxDiscountAmount: number;
    minOrderAmount: number;
    minParticipants: number;
    daysInAdvance: number;
    firstBookingOnly: boolean;
    targetTourIds: string[];
    startsAt: string;
    endsAt: string;
    usageLimit: number;
    usageLimitPerUser: number;
    isActive: boolean;
    isArchived: boolean;
  }>;
}
