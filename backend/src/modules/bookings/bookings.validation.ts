import { z } from 'zod';
import { BOOKING_STATUS } from '@travel-platform/constants';
import { idParamsSchema, objectIdSchema } from '../../utils/object-id';
import { paginationQuerySchema } from '../../utils/pagination';
import { BOOKING_POLICY } from './bookings.policy';

const phone = z.string().trim().regex(/^\+?[0-9 ().-]{6,20}$/, 'Invalid phone number');
const status = z.enum(Object.values(BOOKING_STATUS) as [string, ...string[]]);

export const createBookingBody = z
  .object({
    tourId: objectIdSchema,
    departureId: objectIdSchema,
    participants: z.number().int().min(1).max(BOOKING_POLICY.MAX_PARTICIPANTS),
    contact: z.object({ fullName: z.string().trim().min(2).max(120), phone }).strict(),
    notes: z.string().trim().max(500).optional(),
    promotionCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/).optional(),
    /** Optional retry key (UUID or similar); the same key never creates two bookings. */
    clientRequestId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/).optional(),
  })
  .strict();

export const cancelBookingBody = z.object({ reason: z.string().trim().max(500).optional() }).strict();

export const listBookingsQuery = paginationQuerySchema.extend({ status: status.optional() });

export const listAgencyBookingsQuery = paginationQuerySchema
  .extend({
    status: status.optional(),
    tourId: objectIdSchema.optional(),
    departureFrom: z.coerce.date().optional(),
    departureTo: z.coerce.date().optional(),
  })
  .refine((q) => !q.departureFrom || !q.departureTo || q.departureFrom <= q.departureTo, {
    message: 'departureFrom > departureTo',
    path: ['departureFrom'],
  });

export const bookingIdParams = idParamsSchema;
export const customersExportQuery = z.object({ departureId: objectIdSchema.optional() });

export type CustomersExportQueryInput = z.infer<typeof customersExportQuery>;
export type CreateBookingBody = z.infer<typeof createBookingBody>;
export type CancelBookingBody = z.infer<typeof cancelBookingBody>;
export type ListBookingsQueryInput = z.infer<typeof listBookingsQuery>;
export type ListAgencyBookingsQueryInput = z.infer<typeof listAgencyBookingsQuery>;
