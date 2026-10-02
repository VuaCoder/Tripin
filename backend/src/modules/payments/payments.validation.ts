import { z } from 'zod';
import { idParamsSchema, objectIdSchema } from '../../utils/object-id';

export const bookingParams = z.object({ bookingId: objectIdSchema });
export const paymentIdParams = idParamsSchema;

export type BookingParams = z.infer<typeof bookingParams>;
