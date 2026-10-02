import { z } from 'zod';
import { objectIdSchema } from '../../utils/object-id';
import { paginationQuerySchema } from '../../utils/pagination';

export const subscribeBody = z.object({ planId: objectIdSchema }).strict();
export const listMySubscriptionsQuery = paginationQuerySchema;

export type SubscribeBody = z.infer<typeof subscribeBody>;
export type ListMySubscriptionsQueryInput = z.infer<typeof listMySubscriptionsQuery>;
