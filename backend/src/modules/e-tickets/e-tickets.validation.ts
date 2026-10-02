import { z } from 'zod';
import { idParamsSchema, idSchema } from '../../utils/id';
import { paginationQuerySchema } from '../../utils/pagination';

export const listETicketsQuery = paginationQuerySchema;
export const eTicketIdParams = idParamsSchema;
export const bookingParams = z.object({ bookingId: idSchema });

export type ListETicketsQueryInput = z.infer<typeof listETicketsQuery>;
export type BookingParams = z.infer<typeof bookingParams>;
