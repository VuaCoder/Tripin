export interface AgePricing { childMinAge: number; adultMinAge: number; childPercent: number; infantPercent: number }
export interface GuestCounts { adults: number; children: number; infants: number }
export interface GuestPriceBreakdown { guests: GuestCounts; adultUnitPrice: number; childUnitPrice: number; infantUnitPrice: number; subtotal: number }
export function guestTotal(guests: GuestCounts): number { return guests.adults + guests.children + guests.infants; }
export function calculateGuestPrice(unitPrice: number, participants: number, counts?: GuestCounts, pricing?: AgePricing | null): GuestPriceBreakdown {
  const guests = counts ?? { adults: participants, children: 0, infants: 0 };
  if (![guests.adults, guests.children, guests.infants].every(value => Number.isInteger(value) && value >= 0) || guests.adults < 1 || guestTotal(guests) !== participants || participants > 50) throw new RangeError('Guest counts must match participants and include at least one adult');
  if ((guests.children || guests.infants) && !pricing) throw new RangeError('This tour does not offer age-based pricing');
  const childUnitPrice = Math.round(unitPrice * (pricing?.childPercent ?? 100) / 100);
  const infantUnitPrice = Math.round(unitPrice * (pricing?.infantPercent ?? 100) / 100);
  const subtotal = unitPrice * guests.adults + childUnitPrice * guests.children + infantUnitPrice * guests.infants;
  if (!Number.isSafeInteger(subtotal) || subtotal < 0 || subtotal > 2147483647) throw new RangeError('Tour amount exceeds supported VND range');
  return { guests, adultUnitPrice: unitPrice, childUnitPrice, infantUnitPrice, subtotal };
}
