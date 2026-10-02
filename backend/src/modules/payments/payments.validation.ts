import { z } from 'zod';
import { idParamsSchema, idSchema } from '../../utils/id';

export const bookingParams = z.object({ bookingId: idSchema });
export const paymentIdParams = idParamsSchema;

export type BookingParams = z.infer<typeof bookingParams>;
