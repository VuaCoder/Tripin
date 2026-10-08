/** Mirrors `WishlistItemDto` / `TourListItemDto` from the backend `wishlists` and `tours` modules. */

export interface WishlistTourAgency {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface WishlistTourCard {
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
  agency?: WishlistTourAgency;
}

export interface WishlistItem {
  tourId: string;
  addedAt: string;
  /** False when the tour is no longer public (suspended, archived, deleted); `tour` is then absent. */
  available: boolean;
  tour?: WishlistTourCard;
}

export interface WishlistPageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface WishlistPageData {
  items: WishlistItem[];
  meta: WishlistPageMeta;
}

export interface WishlistListArgs {
  page?: number;
  limit?: number;
}

export interface WishlistApiResponse<T> {
  success: boolean;
  data: T;
  meta?: WishlistPageMeta;
  error?: { code: string; message: string; details?: unknown };
}

export interface WishlistSavedResult {
  tourId: string;
  saved: true;
}

/** Backend page-size ceiling (`MAX_PAGE_SIZE`) and per-traveler cap (`WISHLIST_LIMITS.MAX_ITEMS`). */
export const WISHLIST_UI_LIMITS = { PAGE_SIZE: 100, MAX_ITEMS: 200, LIST_PAGE_SIZE: 12 } as const;
