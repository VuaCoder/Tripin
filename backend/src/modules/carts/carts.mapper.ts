import type { DepartureFacts, TourListItemDto } from '../tours';
import type { CartItemRecord } from './carts.repository';
import type { CartItemDepartureDto, CartItemDto, CartTotalsDto } from './carts.types';

function toDepartureDto(facts: DepartureFacts): CartItemDepartureDto {
  return { id: facts.departureId, date: facts.date.toISOString(), price: facts.price, remaining: facts.remaining };
}

/**
 * Builds one cart line from the stored row plus the live tour card / departure facts. Availability is derived, never
 * stored: a line is bookable only when its tour is public, its departure is open+future+with seats, and it still fits
 * the requested head-count.
 */
export function toCartItemDto(row: CartItemRecord, card?: TourListItemDto, facts?: DepartureFacts): CartItemDto {
  const base = {
    id: row.id,
    tourId: row.tourId,
    departureId: row.departureId,
    participants: row.participants,
    addedAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };

  if (!card) return { ...base, available: false, unavailableReason: 'TOUR_UNAVAILABLE' };
  if (!facts || !facts.bookable) {
    return { ...base, available: false, unavailableReason: 'DEPARTURE_UNAVAILABLE', tour: card, departure: facts ? toDepartureDto(facts) : undefined };
  }
  if (facts.remaining < row.participants) {
    return { ...base, available: false, unavailableReason: 'NOT_ENOUGH_SEATS', tour: card, departure: toDepartureDto(facts) };
  }

  const unitPrice = facts.price;
  return {
    ...base,
    available: true,
    tour: card,
    departure: toDepartureDto(facts),
    unitPrice,
    subtotal: unitPrice * row.participants,
  };
}

/** Totals are computed over the bookable lines only; unavailable lines never contribute money or head-count. */
export function toCartTotals(items: CartItemDto[]): CartTotalsDto {
  const available = items.filter((item) => item.available);
  return {
    itemCount: items.length,
    participantCount: available.reduce((sum, item) => sum + item.participants, 0),
    availableCount: available.length,
    unavailableCount: items.length - available.length,
    subtotal: available.reduce((sum, item) => sum + (item.subtotal ?? 0), 0),
    currency: 'VND',
  };
}
