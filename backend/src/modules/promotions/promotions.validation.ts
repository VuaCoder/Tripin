import { dateRangeFields, validDateRange } from '../../utils/date-range';
import { z } from 'zod';
import { DISCOUNT_TYPE, PROMOTION_APPLY_TYPE, PROMOTION_CODE_TYPE } from '@travel-platform/constants';
import { idParamsSchema, idSchema } from '../../utils/id';
import { paginationQuerySchema } from '../../utils/pagination';

const vnd = z.number().int().min(1).max(100_000_000_000);
const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{3,30}$/, 'Code must be 3-30 characters: letters, digits, "-" or "_"');

export const createPromotionBody = z
  .object({
    applyType: z.enum([PROMOTION_APPLY_TYPE.CODE, PROMOTION_APPLY_TYPE.AUTO_APPLY, PROMOTION_APPLY_TYPE.COLLECTABLE]).optional(),
    codeType: z.enum([PROMOTION_CODE_TYPE.SHARED, PROMOTION_CODE_TYPE.UNIQUE_BATCH]).optional(),
    code: code.optional(),
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(2000).optional(),
    discountType: z.enum([DISCOUNT_TYPE.PERCENT, DISCOUNT_TYPE.FIXED]),
    discountValue: z.number().int().min(1).max(100_000_000_000),
    maxDiscountAmount: vnd.optional(),
    minOrderAmount: z.number().int().min(0).max(100_000_000_000).optional(),
    minParticipants: z.number().int().min(1).max(10_000).optional(),
    daysInAdvance: z.number().int().min(0).max(365).optional(),
    firstBookingOnly: z.boolean().optional(),
    targetTourIds: z.array(idSchema).max(100).optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    usageLimit: z.number().int().min(1).max(10_000_000).optional(),
    usageLimitPerUser: z.number().int().min(1).max(10_000).optional(),
  })
  .strict();

export const updatePromotionBody = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(2000),
    discountValue: z.number().int().min(1).max(100_000_000_000),
    maxDiscountAmount: vnd,
    minOrderAmount: z.number().int().min(0).max(100_000_000_000),
    minParticipants: z.number().int().min(1).max(10_000),
    daysInAdvance: z.number().int().min(0).max(365),
    firstBookingOnly: z.boolean(),
    targetTourIds: z.array(idSchema).max(100),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    usageLimit: z.number().int().min(1).max(10_000_000),
    usageLimitPerUser: z.number().int().min(1).max(10_000),
    isActive: z.boolean(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export const listPromotionsQuery = paginationQuerySchema.extend({
  ...dateRangeFields,
  q: z.string().trim().max(100).optional(),
  discountType: z.enum([DISCOUNT_TYPE.PERCENT, DISCOUNT_TYPE.FIXED]).optional(),
  applyType: z.enum([PROMOTION_APPLY_TYPE.CODE, PROMOTION_APPLY_TYPE.AUTO_APPLY, PROMOTION_APPLY_TYPE.COLLECTABLE]).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
}).refine(validDateRange, 'Provide both from and to, with from <= to');

export const previewQuery = z.object({
  code,
  tourId: idSchema,
  subtotal: z.coerce.number().int().min(1).max(100_000_000_000),
  participants: z.coerce.number().int().min(1).max(10_000).optional(),
  departureDate: z.coerce.date().optional(),
});

export const availableQuery = z.object({
  tourId: idSchema,
  subtotal: z.coerce.number().int().min(1).max(100_000_000_000).optional(),
  participants: z.coerce.number().int().min(1).max(10_000).optional(),
  departureDate: z.coerce.date().optional(),
});

export const generateBatchBody = z.object({
  count: z.number().int().min(1).max(1000),
  prefix: z.string().trim().max(10).optional(),
});

export const collectVoucherBody = z.object({
  promotionId: idSchema,
});

export const promotionIdParams = idParamsSchema;

export type CreatePromotionBody = z.infer<typeof createPromotionBody>;
export type UpdatePromotionBody = z.infer<typeof updatePromotionBody>;
export type ListPromotionsQueryInput = z.infer<typeof listPromotionsQuery>;
export type PreviewQueryInput = z.infer<typeof previewQuery>;
export type AvailableQueryInput = z.infer<typeof availableQuery>;
