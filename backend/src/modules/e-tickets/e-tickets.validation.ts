import { z } from 'zod';
import { idParamsSchema, idSchema } from '../../utils/id';
import { paginationQuerySchema } from '../../utils/pagination';

export const listETicketsQuery = paginationQuerySchema;
export const eTicketIdParams = idParamsSchema;
export const bookingParams = z.object({ bookingId: idSchema });
export const guideTourParams = z.object({ tourId: idSchema });
export const guideCheckInBody = z.object({ code: z.string().trim().toUpperCase().min(1).max(64) }).strict();

export type ListETicketsQueryInput = z.infer<typeof listETicketsQuery>;
export type BookingParams = z.infer<typeof bookingParams>;
export type GuideTourParams = z.infer<typeof guideTourParams>;
export type GuideCheckInBodyInput = z.infer<typeof guideCheckInBody>;
