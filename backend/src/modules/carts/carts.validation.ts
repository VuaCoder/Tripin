import { z } from 'zod';
import { idParamsSchema, idSchema } from '../../utils/id';
import { BOOKING_POLICY } from '../bookings';
import { guestCountsSchema } from '../../utils/age-pricing';

/** A head-count is bounded by the same ceiling a booking accepts, so the cart can never hold an unbookable count. */
const participants = z.number().int().min(1).max(BOOKING_POLICY.MAX_PARTICIPANTS);

export const addCartItemBody = z
  .object({
    tourId: idSchema,
    departureId: idSchema,
    participants,
    guestCounts: guestCountsSchema.optional(),
  })
  .strict();

export const updateCartItemBody = z.object({ participants, guestCounts: guestCountsSchema.optional() }).strict();

export const cartItemParams = idParamsSchema;

export type AddCartItemBody = z.infer<typeof addCartItemBody>;
export type UpdateCartItemBody = z.infer<typeof updateCartItemBody>;
