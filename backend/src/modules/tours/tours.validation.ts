import { z } from 'zod';
import { TOUR_STATUS } from '@travel-platform/constants';
import { idParamsSchema, idSchema } from '../../utils/id';
import { paginationQuerySchema } from '../../utils/pagination';
import { TOUR_LIMITS } from './tours.types';

const text = (max: number) => z.string().trim().max(max);
const stringList = (maxItems: number, maxLen: number) => z.array(z.string().trim().min(1).max(maxLen)).max(maxItems);
const vnd = z.number().int().min(0).max(100_000_000_000);

const tourContentShape = {
  title: z.string().trim().min(5).max(200),
  summary: text(500).optional(),
  description: text(20_000).optional(),
  destination: z.string().trim().min(2).max(120),
  durationDays: z.number().int().min(1).max(365),
  basePrice: vnd,
  maxGroupSize: z.number().int().min(1).max(10_000).optional(),
  categoryIds: z.array(idSchema).min(1).max(10),
  images: z.array(z.url().max(500)).max(TOUR_LIMITS.MAX_IMAGES).optional(),
  inclusions: stringList(50, 300).optional(),
  exclusions: stringList(50, 300).optional(),
};

export const createTourBody = z.object(tourContentShape).strict();

export const updateTourBody = z
  .object(tourContentShape)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export const importToursBody = z
  .object({ tours: z.array(createTourBody).min(1).max(TOUR_LIMITS.MAX_IMPORT_BATCH) })
  .strict();

const departureShape = z
  .object({
    id: idSchema.optional(),
    date: z.coerce.date(),
    capacity: z.number().int().min(1).max(10_000),
    priceOverride: vnd.optional(),
    isOpen: z.boolean().default(true),
  })
  .strict();

export const availabilityBody = z
  .object({ departures: z.array(departureShape).max(TOUR_LIMITS.MAX_DEPARTURES) })
  .strict()
  .refine((value) => new Set(value.departures.map((d) => d.id).filter(Boolean)).size === value.departures.filter((d) => d.id).length, {
    message: 'Duplicate departure id',
    path: ['departures'],
  });

export const itineraryBody = z
  .object({
    days: z
      .array(
        z
          .object({
            day: z.number().int().min(1).max(365),
            title: z.string().trim().min(2).max(200),
            description: text(5000).optional(),
            activities: stringList(30, 300).optional(),
          })
          .strict(),
      )
      .max(365),
  })
  .strict()
  .refine((value) => new Set(value.days.map((d) => d.day)).size === value.days.length, { message: 'Duplicate day number', path: ['days'] });

export const assignGuideBody = z
  .object({ guideId: idSchema.nullable(), feePerBooking: vnd.optional() })
  .strict()
  .refine((value) => value.guideId === null || value.feePerBooking !== undefined, {
    message: 'feePerBooking is required when assigning a guide',
    path: ['feePerBooking'],
  });

export const guideVerificationBody = z.object({ accept: z.boolean(), note: text(500).optional() }).strict();

export const tourIdParams = idParamsSchema;
export const guideTourParams = z.object({ tourId: idSchema });

export const searchToursQuery = paginationQuerySchema
  .extend({
    q: z.string().trim().min(1).max(100).optional(),
    categoryId: idSchema.optional(),
    destination: z.string().trim().min(1).max(120).optional(),
    minPrice: z.coerce.number().int().min(0).optional(),
    maxPrice: z.coerce.number().int().min(0).optional(),
    minDays: z.coerce.number().int().min(1).optional(),
    maxDays: z.coerce.number().int().min(1).optional(),
    departureFrom: z.coerce.date().optional(),
    departureTo: z.coerce.date().optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
    sort: z.enum(['newest', 'price_asc', 'price_desc', 'rating']).default('newest'),
  })
  .refine((q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice, { message: 'minPrice > maxPrice', path: ['minPrice'] })
  .refine((q) => q.minDays === undefined || q.maxDays === undefined || q.minDays <= q.maxDays, { message: 'minDays > maxDays', path: ['minDays'] })
  .refine((q) => !q.departureFrom || !q.departureTo || q.departureFrom <= q.departureTo, { message: 'departureFrom > departureTo', path: ['departureFrom'] });

export const agencyToursQuery = paginationQuerySchema.extend({
  status: z.enum(Object.values(TOUR_STATUS) as [string, ...string[]]).optional(),
});

export type CreateTourBody = z.infer<typeof createTourBody>;
export type UpdateTourBody = z.infer<typeof updateTourBody>;
export type ImportToursBody = z.infer<typeof importToursBody>;
export type AvailabilityBody = z.infer<typeof availabilityBody>;
export type ItineraryBody = z.infer<typeof itineraryBody>;
export type AssignGuideBody = z.infer<typeof assignGuideBody>;
export type GuideVerificationBody = z.infer<typeof guideVerificationBody>;
export type SearchToursQueryInput = z.infer<typeof searchToursQuery>;
export type AgencyToursQueryInput = z.infer<typeof agencyToursQuery>;
