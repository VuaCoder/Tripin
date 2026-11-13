import { z } from 'zod';
import { CUSTOM_TOUR_POLICY, CUSTOM_TOUR_STATUS, PASSENGER_TYPE, guestTotal } from '@travel-platform/constants';
import { guestCountsSchema } from '../../utils/age-pricing';
import { idParamsSchema, idSchema } from '../../utils/id';
import { paginationQuerySchema } from '../../utils/pagination';
import { tourContentShape } from '../tours/tours.validation';

const participants = z.number().int().min(CUSTOM_TOUR_POLICY.MIN_PARTICIPANTS).max(CUSTOM_TOUR_POLICY.MAX_PARTICIPANTS);

const phone = z.string().trim().regex(/^\+?[0-9 ().-]{6,20}$/, 'Invalid phone number');
const idCard = z.string().trim().regex(/^\d{12}$/, 'ID card must be exactly 12 digits');

// `maxGroupSize` is not editable from a request: it is always the requested head count.
const { maxGroupSize: _maxGroupSize, ...customTourContentShape } = tourContentShape;

export const saveCustomTourDraftBody = z
  .object({
    revision: z.number().int().min(1),
    content: z
      .object(customTourContentShape)
      .partial()
      .strict()
      .refine((value) => Object.keys(value).length > 0, 'Nothing to update')
      .optional(),
    guestCounts: guestCountsSchema.optional(),
    departure: z
      .object({
        date: z.coerce.date().refine((date) => date.getTime() > Date.now(), 'Departure date must be in the future'),
        capacity: z.number().int().min(1).max(10_000).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((value) => value.content !== undefined || value.guestCounts !== undefined || value.departure !== undefined, 'Nothing to update');

export const sendCustomTourOfferBody = z.object({ revision: z.number().int().min(1) }).strict();

export const acceptCustomTourOfferBody = z.object({ revision: z.number().int().min(1) }).strict();

export const createCustomTourBody = z
  .object({
    sourceTourId: idSchema,
    participants,
    guestCounts: guestCountsSchema.optional(),
    startDate: z.coerce.date().refine((date) => date.getTime() > Date.now(), 'Start date must be in the future').optional(),
    notes: z.string().trim().max(CUSTOM_TOUR_POLICY.MAX_NOTES).optional(),
    clientRequestId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/).optional(),
  })
  .strict()
  .refine((value) => !value.guestCounts || guestTotal(value.guestCounts) === value.participants, 'Guest counts must sum to participants');

export const listCustomToursQuery = paginationQuerySchema.extend({
  status: z.nativeEnum(CUSTOM_TOUR_STATUS).optional(),
  conversationId: idSchema.optional(),
});

export const decideCustomTourBody = z.object({ decision: z.enum(['ACCEPT', 'DECLINE', 'CANCEL']) }).strict();

// The counts must match the accepted offer; the service checks them against the request, so a stale tab gets one clear 400.
const checkoutDraftShape = {
  contact: z.object({ fullName: z.string().trim().min(2).max(120), phone }).strict(),
  passengers: z
    .array(z.object({ fullName: z.string().trim().min(2).max(120), phone, idCard, guestType: z.nativeEnum(PASSENGER_TYPE) }).strict())
    .min(CUSTOM_TOUR_POLICY.MIN_PARTICIPANTS)
    .max(CUSTOM_TOUR_POLICY.MAX_PARTICIPANTS),
  notes: z.string().trim().max(CUSTOM_TOUR_POLICY.MAX_NOTES).optional(),
};
const uniqueIdCards = (value: { passengers: { idCard: string }[] }) =>
  new Set(value.passengers.map((passenger) => passenger.idCard)).size === value.passengers.length;

export const saveCustomTourCheckoutBody = z
  .object({ checkoutRevision: z.number().int().min(1), ...checkoutDraftShape })
  .strict()
  .refine(uniqueIdCards, 'ID cards must be unique');

/** The same shape, re-read from the request when the booking is created: stored JSON is data, not a guarantee. */
export const customTourCheckoutDraft = z.object(checkoutDraftShape).strict().refine(uniqueIdCards, 'ID cards must be unique');

export const createCustomTourBookingBody = z.object({ clientRequestId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/).optional() }).strict();

export const customTourParams = idParamsSchema;

export type CreateCustomTourBody = z.infer<typeof createCustomTourBody>;
export type ListCustomToursQueryInput = z.infer<typeof listCustomToursQuery>;
export type DecideCustomTourBody = z.infer<typeof decideCustomTourBody>;
export type SaveCustomTourDraftBody = z.infer<typeof saveCustomTourDraftBody>;
export type SaveCustomTourCheckoutBody = z.infer<typeof saveCustomTourCheckoutBody>;
export type SendCustomTourOfferBody = z.infer<typeof sendCustomTourOfferBody>;
export type AcceptCustomTourOfferBody = z.infer<typeof acceptCustomTourOfferBody>;
export type CreateCustomTourBookingBody = z.infer<typeof createCustomTourBookingBody>;
