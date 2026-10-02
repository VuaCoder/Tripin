import { z } from 'zod';
import { objectIdSchema } from '../../utils/object-id';
import { paginationQuerySchema } from '../../utils/pagination';

export const createReviewBody = z
  .object({
    bookingId: objectIdSchema,
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().min(10, 'Please write at least 10 characters').max(2000),
  })
  .strict();

export const listPublicReviewsQuery = paginationQuerySchema
  .extend({
    tourId: objectIdSchema.optional(),
    agencyId: objectIdSchema.optional(),
    sort: z.enum(['newest', 'rating_desc', 'rating_asc']).default('newest'),
  })
  .refine((q) => Boolean(q.tourId) !== Boolean(q.agencyId), { message: 'Provide exactly one of tourId or agencyId', path: ['tourId'] });

export const listMyReviewsQuery = paginationQuerySchema;

export const moderateReviewBody = z
  .object({ hide: z.boolean(), reason: z.string().trim().min(3).max(500).optional() })
  .strict()
  .refine((value) => !value.hide || Boolean(value.reason), { message: 'reason is required when hiding', path: ['reason'] });

export type CreateReviewBody = z.infer<typeof createReviewBody>;
export type ListPublicReviewsQueryInput = z.infer<typeof listPublicReviewsQuery>;
export type ListMyReviewsQueryInput = z.infer<typeof listMyReviewsQuery>;
export type ModerateReviewBody = z.infer<typeof moderateReviewBody>;
