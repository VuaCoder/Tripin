import { TOUR_STATUS } from '@travel-platform/constants';
import { AppError } from '../../utils/app-error';
import { buildPage, type Page } from '../../utils/pagination';
import { toursDiscoveryService, toursService, type ToursDiscoveryService, type ToursService } from '../tours';
import { wishlistsRepository, type WishlistsRepository } from './wishlists.repository';
import { WISHLIST_LIMITS, type WishlistItemDto } from './wishlists.types';

export class WishlistsService {
  constructor(
    private readonly items: Pick<WishlistsRepository, 'addIfAbsent' | 'exists' | 'count' | 'remove' | 'list'> = wishlistsRepository,
    private readonly tours: Pick<ToursService, 'getTourFacts'> = toursService,
    private readonly discovery: Pick<ToursDiscoveryService, 'getPublicCards'> = toursDiscoveryService,
  ) {}

  /** Use case "Add wishlist". Idempotent: saving the same tour twice is a no-op that still succeeds. */
  async add(userId: string, tourId: string): Promise<{ created: boolean }> {
    const tour = await this.tours.getTourFacts(tourId);
    if (!tour || tour.status !== TOUR_STATUS.APPROVED) throw AppError.notFound('Tour not found');

    if (!(await this.items.exists(userId, tourId)) && (await this.items.count(userId)) >= WISHLIST_LIMITS.MAX_ITEMS) {
      throw AppError.conflict(`Your wishlist is full (${WISHLIST_LIMITS.MAX_ITEMS} tours)`, 'WISHLIST_FULL');
    }
    return { created: await this.items.addIfAbsent(userId, tourId) };
  }

  /** Use case "Remove tour from wishlist". Idempotent: removing a tour that is not saved succeeds silently. */
  async remove(userId: string, tourId: string): Promise<void> {
    await this.items.remove(userId, tourId);
  }

  /** The traveler's saved tours, newest first. Tours that are no longer public are still listed, flagged `available:false`. */
  async list(userId: string, page: { page: number; limit: number }): Promise<Page<WishlistItemDto>> {
    const { items, total } = await this.items.list(userId, page);
    const cards = await this.discovery.getPublicCards(items.map((item) => String(item.tourId)));
    const dtos = items.map((item): WishlistItemDto => {
      const tourId = String(item.tourId);
      const tour = cards.get(tourId);
      return {
        tourId,
        addedAt: (item as unknown as { createdAt: Date }).createdAt.toISOString(),
        available: Boolean(tour),
        tour,
      };
    });
    return buildPage(dtos, total, page);
  }
}

export const wishlistsService = new WishlistsService();
