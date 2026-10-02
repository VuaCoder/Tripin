import { z } from 'zod';
import { idParamsSchema, objectIdSchema } from '../../utils/object-id';
import { paginationQuerySchema } from '../../utils/pagination';

export const listETicketsQuery = paginationQuerySchema;
export const eTicketIdParams = idParamsSchema;
export const bookingParams = z.object({ bookingId: objectIdSchema });

export type ListETicketsQueryInput = z.infer<typeof listETicketsQuery>;
export type BookingParams = z.infer<typeof bookingParams>;
