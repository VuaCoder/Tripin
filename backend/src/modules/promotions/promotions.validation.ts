import { z } from 'zod';
import { DISCOUNT_TYPE } from '@travel-platform/constants';
import { idParamsSchema, objectIdSchema } from '../../utils/object-id';
import { paginationQuerySchema } from '../../utils/pagination';

const vnd = z.number().int().min(1).max(100_000_000_000);
const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{3,30}$/, 'Code must be 3-30 characters: letters, digits, "-" or "_"');

export const createPromotionBody = z
  .object({
    code,
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(2000).optional(),
    discountType: z.enum([DISCOUNT_TYPE.PERCENT, DISCOUNT_TYPE.FIXED]),
    discountValue: z.number().int().min(1).max(100_000_000_000),
    maxDiscountAmount: vnd.optional(),
    minOrderAmount: z.number().int().min(0).max(100_000_000_000).optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    usageLimit: z.number().int().min(1).max(10_000_000).optional(),
  })
  .strict();

export const updatePromotionBody = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(2000),
    discountValue: z.number().int().min(1).max(100_000_000_000),
    maxDiscountAmount: vnd,
    minOrderAmount: z.number().int().min(0).max(100_000_000_000),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    usageLimit: z.number().int().min(1).max(10_000_000),
    isActive: z.boolean(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export const listPromotionsQuery = paginationQuerySchema.extend({
  isActive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export const previewQuery = z.object({
  code,
  tourId: objectIdSchema,
  subtotal: z.coerce.number().int().min(1).max(100_000_000_000),
});

export const promotionIdParams = idParamsSchema;

export type CreatePromotionBody = z.infer<typeof createPromotionBody>;
export type UpdatePromotionBody = z.infer<typeof updatePromotionBody>;
export type ListPromotionsQueryInput = z.infer<typeof listPromotionsQuery>;
export type PreviewQueryInput = z.infer<typeof previewQuery>;
