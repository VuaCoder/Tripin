import { assertVnd, MONEY_LIMITS, ratioVnd, safeVndNumber } from './money';

export interface AgePricing {
  childMinAge: number;
  adultMinAge: number;
  childPercent: number;
  infantPercent: number;
  childPrice?: number | null;
  infantPrice?: number | null;
  adultMaxCount?: number | null;
  childMaxCount?: number | null;
  infantMaxCount?: number | null;
}
export interface GuestCounts { adults: number; children: number; infants: number }
export function resolveGuestGroupCounts(totalCapacity: number, pricing?: AgePricing | null): GuestCounts {
  const safeTotal = Math.max(0, Math.round(totalCapacity));
  const hasGroupLimits = pricing && (typeof pricing.adultMaxCount === 'number' || typeof pricing.childMaxCount === 'number' || typeof pricing.infantMaxCount === 'number');
  if (!hasGroupLimits) return { adults: safeTotal, children: 0, infants: 0 };
  const rawAdults = Math.max(0, Math.round(pricing.adultMaxCount ?? 0));
  const rawChildren = Math.max(0, Math.round(pricing.childMaxCount ?? 0));
  const rawInfants = Math.max(0, Math.round(pricing.infantMaxCount ?? 0));
  if (rawAdults + rawChildren + rawInfants === safeTotal) {
    return { adults: rawAdults, children: rawChildren, infants: rawInfants };
  }
  const children = Math.min(rawChildren, safeTotal);
  const infants = Math.min(rawInfants, Math.max(0, safeTotal - children));
  const adults = Math.max(0, safeTotal - children - infants);
  return { adults, children, infants };
}
export interface GuestPriceBreakdown { guests: GuestCounts; adultUnitPrice: number; childUnitPrice: number; infantUnitPrice: number; subtotal: number }
export function ageUnitPrice(unitPrice: number, pricing: AgePricing | null | undefined, group: 'child' | 'infant'): number | null {
  if (!pricing) return null;
  const price = pricing[group === 'child' ? 'childPrice' : 'infantPrice'];
  return price !== undefined ? price : ratioVnd(unitPrice, pricing[group === 'child' ? 'childPercent' : 'infantPercent'], 100, 'round');
}
export function guestTotal(guests: GuestCounts): number { return guests.adults + guests.children + guests.infants; }
export function calculateGuestPrice(unitPrice: number, participants: number, counts?: GuestCounts, pricing?: AgePricing | null): GuestPriceBreakdown {
  const guests = counts ?? { adults: participants, children: 0, infants: 0 };
  if (![guests.adults, guests.children, guests.infants].every(value => Number.isInteger(value) && value >= 0) || guests.adults < 1 || guestTotal(guests) !== participants || participants > 50) throw new RangeError('Guest counts must match participants and include at least one adult');
  if ((guests.children || guests.infants) && !pricing) throw new RangeError('This tour does not offer age-based pricing');
  assertVnd(unitPrice, MONEY_LIMITS.MAX_UNIT_PRICE);
  const child = ageUnitPrice(unitPrice, pricing, 'child');
  const infant = ageUnitPrice(unitPrice, pricing, 'infant');
  if ((guests.children && child === null) || (guests.infants && infant === null)) throw new RangeError('Selected age group is unavailable');
  const childUnitPrice = child ?? unitPrice;
  const infantUnitPrice = infant ?? unitPrice;
  assertVnd(childUnitPrice, MONEY_LIMITS.MAX_UNIT_PRICE);
  assertVnd(infantUnitPrice, MONEY_LIMITS.MAX_UNIT_PRICE);
  const subtotal = safeVndNumber(BigInt(unitPrice) * BigInt(guests.adults) + BigInt(childUnitPrice) * BigInt(guests.children) + BigInt(infantUnitPrice) * BigInt(guests.infants));
  assertVnd(subtotal, MONEY_LIMITS.MAX_BOOKING_AMOUNT);
  return { guests, adultUnitPrice: unitPrice, childUnitPrice, infantUnitPrice, subtotal };
}
