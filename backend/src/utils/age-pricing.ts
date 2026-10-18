import { z } from 'zod';
import { calculateGuestPrice, type AgePricing, type GuestCounts } from '@travel-platform/constants';
import { AppError } from './app-error';
export const agePricingSchema = z.object({
  childMinAge: z.number().int().min(1).max(17), adultMinAge: z.number().int().min(2).max(18),
  childPercent: z.number().int().min(0).max(100), infantPercent: z.number().int().min(0).max(100),
}).strict().refine(value => value.childMinAge < value.adultMinAge, 'Child minimum age must be lower than adult minimum age');
export const guestCountsSchema = z.object({ adults: z.number().int().min(1).max(50), children: z.number().int().min(0).max(49), infants: z.number().int().min(0).max(49) }).strict();
export function priceGuests(unitPrice: number, participants: number, guests?: GuestCounts, pricing?: AgePricing | null) {
  try { return calculateGuestPrice(unitPrice, participants, guests, pricing); }
  catch (error) { throw AppError.badRequest((error as Error).message); }
}
