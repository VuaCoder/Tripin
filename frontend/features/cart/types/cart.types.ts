/** Mirrors `TourListItemDto` from the backend `tours` module (the card shape used by `GET /tours`). */
export interface CartTourAgency {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface CartTourCard {
  id: string;
  title: string;
  summary?: string;
  destination: string;
  durationDays: number;
  basePrice: number;
  coverImage?: string;
  categoryIds: string[];
  ratingAvg: number;
  ratingCount: number;
  nextDepartureDate?: string;
  agency?: CartTourAgency;
}

export interface CartDeparture {
  id: string;
  date: string;
  price: number;
  remaining: number;
}

/** Why a line can no longer be booked (mirrors the backend `CartItemUnavailableReason`). */
export type CartItemUnavailableReason = 'TOUR_UNAVAILABLE' | 'DEPARTURE_UNAVAILABLE' | 'NOT_ENOUGH_SEATS';

export interface CartItem {
  id: string;
  tourId: string;
  departureId: string;
  participants: number;
  addedAt: string;
  updatedAt: string;
  available: boolean;
  unavailableReason?: CartItemUnavailableReason;
  tour?: CartTourCard;
  departure?: CartDeparture;
  /** Present only when the line is bookable; computed by the backend from live tour data. */
  unitPrice?: number;
  subtotal?: number;
}

export interface CartTotals {
  itemCount: number;
  participantCount: number;
  availableCount: number;
  unavailableCount: number;
  /** Whole VND, bookable lines only. */
  subtotal: number;
  currency: 'VND';
}

export interface Cart {
  items: CartItem[];
  totals: CartTotals;
}

export interface AddCartItemInput {
  tourId: string;
  departureId: string;
  participants: number;
}

export interface UpdateCartItemInput {
  id: string;
  participants: number;
}

export interface CartApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string; details?: unknown };
}

/** Vietnamese labels for the machine-readable unavailability reasons. */
export const CART_UNAVAILABLE_LABELS: Record<CartItemUnavailableReason, string> = {
  TOUR_UNAVAILABLE: 'Tour này hiện không còn được bán.',
  DEPARTURE_UNAVAILABLE: 'Ngày khởi hành đã đóng hoặc đã hết chỗ.',
  NOT_ENOUGH_SEATS: 'Không còn đủ chỗ cho số khách đã chọn.',
};
