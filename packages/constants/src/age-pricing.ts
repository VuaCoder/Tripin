import { assertVnd, MONEY_LIMITS, ratioVnd, safeVndNumber } from './money';

export interface AgePricing { childMinAge: number; adultMinAge: number; childPercent: number; infantPercent: number }
export interface GuestCounts { adults: number; children: number; infants: number }
export interface GuestPriceBreakdown { guests: GuestCounts; adultUnitPrice: number; childUnitPrice: number; infantUnitPrice: number; subtotal: number }
export function guestTotal(guests: GuestCounts): number { return guests.adults + guests.children + guests.infants; }
export function calculateGuestPrice(unitPrice: number, participants: number, counts?: GuestCounts, pricing?: AgePricing | null): GuestPriceBreakdown {
  const guests = counts ?? { adults: participants, children: 0, infants: 0 };
  if (![guests.adults, guests.children, guests.infants].every(value => Number.isInteger(value) && value >= 0) || guests.adults < 1 || guestTotal(guests) !== participants || participants > 50) throw new RangeError('Guest counts must match participants and include at least one adult');
  if ((guests.children || guests.infants) && !pricing) throw new RangeError('This tour does not offer age-based pricing');
  assertVnd(unitPrice, MONEY_LIMITS.MAX_UNIT_PRICE);
  const childUnitPrice = ratioVnd(unitPrice, pricing?.childPercent ?? 100, 100, 'round');
  const infantUnitPrice = ratioVnd(unitPrice, pricing?.infantPercent ?? 100, 100, 'round');
  const subtotal = safeVndNumber(BigInt(unitPrice) * BigInt(guests.adults) + BigInt(childUnitPrice) * BigInt(guests.children) + BigInt(infantUnitPrice) * BigInt(guests.infants));
  assertVnd(subtotal, MONEY_LIMITS.MAX_BOOKING_AMOUNT);
  return { guests, adultUnitPrice: unitPrice, childUnitPrice, infantUnitPrice, subtotal };
}
