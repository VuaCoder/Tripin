/** Wire shapes of `/agency/promotions` (`PromotionDto` in the backend `promotions` module). */

export type DiscountType = 'PERCENT' | 'FIXED';

export interface AgencyPromotion {
  id: string;
  scope: 'AGENCY' | 'PLATFORM';
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
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  isActive?: boolean;
}

export interface CreatePromotionInput {
  code: string;
  title: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderAmount?: number;
  startsAt: string;
  endsAt: string;
  usageLimit?: number;
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
    startsAt: string;
    endsAt: string;
    usageLimit: number;
    isActive: boolean;
  }>;
}
