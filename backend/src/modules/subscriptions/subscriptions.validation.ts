import { z } from 'zod';
import { idSchema } from '../../utils/id';
import { paginationQuerySchema } from '../../utils/pagination';

export const subscribeBody = z.object({ planId: idSchema }).strict();
export const listMySubscriptionsQuery = paginationQuerySchema;

export type SubscribeBody = z.infer<typeof subscribeBody>;
export type ListMySubscriptionsQueryInput = z.infer<typeof listMySubscriptionsQuery>;
