import { z } from 'zod';
import { containsProfanity, PROFANITY_ERROR_MESSAGE } from '@travel-platform/constants';
import { idSchema } from '../../utils/id';
import { paginationQuerySchema } from '../../utils/pagination';

export const createReviewBody = z
  .object({
    bookingId: idSchema,
    rating: z.number().int().min(1).max(5),
    comment: z
      .string()
      .trim()
      .min(10, 'Please write at least 10 characters')
      .max(2000)
      .refine((val) => !containsProfanity(val), PROFANITY_ERROR_MESSAGE),
    imagePublicIds: z.array(z.string().min(1).max(300)).max(6).refine(ids => new Set(ids).size === ids.length, 'Duplicate images are not allowed').optional(),
  })
  .strict();

export const listPublicReviewsQuery = paginationQuerySchema
  .extend({
    tourId: idSchema.optional(),
    agencyId: idSchema.optional(),
    guideId: idSchema.optional(),
    sort: z.enum(['newest', 'rating_desc', 'rating_asc']).default('newest'),
  })
  .refine((q) => [q.tourId, q.agencyId, q.guideId].filter(Boolean).length === 1, { message: 'Provide exactly one of tourId, agencyId or guideId', path: ['tourId'] });

export const listMyReviewsQuery = paginationQuerySchema;
export const reviewImageSignatureBody = z.object({ bookingId: idSchema }).strict();

export const moderateReviewBody = z
  .object({ hide: z.boolean(), contentVersion: z.string().regex(/^[a-f0-9]{64}$/), reason: z.string().trim().min(3).max(1000).optional(), restorationReason: z.string().trim().min(3).max(1000).optional() })
  .strict()
  .refine((value) => !value.hide || Boolean(value.reason), { message: 'reason is required when hiding', path: ['reason'] })
  .refine((value) => value.hide || Boolean(value.restorationReason), { message: 'restorationReason is required when restoring', path: ['restorationReason'] });

export type CreateReviewBody = z.infer<typeof createReviewBody>;
export type ListPublicReviewsQueryInput = z.infer<typeof listPublicReviewsQuery>;
export type ListMyReviewsQueryInput = z.infer<typeof listMyReviewsQuery>;
export type ModerateReviewBody = z.infer<typeof moderateReviewBody>;
