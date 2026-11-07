import { z } from 'zod';
import { idParamsSchema, idSchema } from '../../utils/id';
import { paginationQuerySchema } from '../../utils/pagination';

export const listETicketsQuery = paginationQuerySchema.extend({ status: z.enum(['VALID', 'USED', 'CANCELLED']).optional() });
export const eTicketIdParams = idParamsSchema;
export const bookingParams = z.object({ bookingId: idSchema });
export const guideTourParams = z.object({ tourId: idSchema });
export const guideCompleteBody = z.object({ departureId: idSchema.optional() }).strict().default({});
export const guideScopeQuery = z.object({ departureId: idSchema.optional() }).strict();
export const guideCheckInBody = z.object({ code: z.string().trim().toUpperCase().min(1).max(64), departureId: idSchema.optional() }).strict();
export const guideScanBody = guideCheckInBody.extend({ tourId: idSchema });

export type ListETicketsQueryInput = z.infer<typeof listETicketsQuery>;
export type BookingParams = z.infer<typeof bookingParams>;
export type GuideTourParams = z.infer<typeof guideTourParams>;
export type GuideCheckInBodyInput = z.infer<typeof guideCheckInBody>;
