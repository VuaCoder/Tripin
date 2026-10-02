import type { TourListItemDto } from '../tours';

export const WISHLIST_LIMITS = {
  /** Maximum saved tours per traveler. */
  MAX_ITEMS: 200,
} as const;

export interface WishlistItemDto {
  tourId: string;
  addedAt: string;
  /** False when the tour is no longer public (suspended, archived, unpublished); `tour` is then absent. */
  available: boolean;
  tour?: TourListItemDto;
}
