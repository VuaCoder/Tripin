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

export const PROMOTION_APPLY_TYPE = {
  CODE: 'CODE',
  AUTO_APPLY: 'AUTO_APPLY',
  COLLECTABLE: 'COLLECTABLE',
} as const;
export type PromotionApplyType = (typeof PROMOTION_APPLY_TYPE)[keyof typeof PROMOTION_APPLY_TYPE];

export const PROMOTION_CODE_TYPE = {
  SHARED: 'SHARED',
  UNIQUE_BATCH: 'UNIQUE_BATCH',
} as const;
export type PromotionCodeType = (typeof PROMOTION_CODE_TYPE)[keyof typeof PROMOTION_CODE_TYPE];
