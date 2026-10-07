import type { TourListItemDto } from '../tours';

/** Tunable cart rules (no magic numbers in the service). */
export const CART_LIMITS = {
  /** Maximum distinct departures a traveler may keep in the cart at once. */
  MAX_ITEMS: 20,
} as const;

/** Why a cart item can no longer be booked. Mirrors the checks the read model performs on live data. */
export type CartItemUnavailableReason = 'TOUR_UNAVAILABLE' | 'DEPARTURE_UNAVAILABLE' | 'NOT_ENOUGH_SEATS';

export interface AddCartItemInput {
  tourId: string;
  departureId: string;
  participants: number;
}

export interface UpdateCartItemInput {
  participants: number;
}

/** Live departure facts attached to a cart line (never stored on the row). */
export interface CartItemDepartureDto {
  id: string;
  date: string;
  price: number;
  remaining: number;
}

/**
 * One line of the cart. Money fields are computed from live tour/departure data at read time and are absent when the
 * item is not bookable. `available:false` items stay in the cart (flagged) so the traveler can fix or remove them.
 */
export interface CartItemDto {
  id: string;
  tourId: string;
  departureId: string;
  participants: number;
  addedAt: string;
  updatedAt: string;
  available: boolean;
  unavailableReason?: CartItemUnavailableReason;
  /** The same card as `GET /tours` items; absent when the tour is no longer public. */
  tour?: TourListItemDto;
  departure?: CartItemDepartureDto;
  unitPrice?: number;
  subtotal?: number;
}

export interface CartTotalsDto {
  itemCount: number;
  /** Sum of the head-counts of the bookable items only. */
  participantCount: number;
  availableCount: number;
  unavailableCount: number;
  /** Sum of the subtotals of the bookable items only, in whole VND. Promotions are applied at booking time, not here. */
  subtotal: number;
  currency: 'VND';
}

export interface CartDto {
  items: CartItemDto[];
  totals: CartTotalsDto;
}
