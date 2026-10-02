import { z } from 'zod';
import { idParamsSchema } from '../../utils/object-id';
import { paginationQuerySchema } from '../../utils/pagination';

export const listNotificationsQuery = paginationQuerySchema.extend({
  unreadOnly: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export const notificationIdParams = idParamsSchema;

export type ListNotificationsQueryInput = z.infer<typeof listNotificationsQuery>;
