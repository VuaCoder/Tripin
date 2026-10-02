export const PROMOTION_SCOPE = {
  /** Created by an agency, valid only for that agency's tours. */
  AGENCY: 'AGENCY',
  /** Created by a SUPER_ADMIN, valid for every tour. */
  PLATFORM: 'PLATFORM',
} as const;
export type PromotionScope = (typeof PROMOTION_SCOPE)[keyof typeof PROMOTION_SCOPE];

export const DISCOUNT_TYPE = {
  PERCENT: 'PERCENT',
  FIXED: 'FIXED',
} as const;
export type DiscountType = (typeof DISCOUNT_TYPE)[keyof typeof DISCOUNT_TYPE];
