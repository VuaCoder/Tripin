import { PERMISSIONS, TOUR_STATUS } from '@travel-platform/constants';
import type { Actor } from '../../types/actor';
import { AppError } from '../../utils/app-error';
import { buildPage, type Page } from '../../utils/pagination';
import { TtlCache } from '../../utils/ttl-cache';
import { toursRepository, type ToursRepository } from './tours.repository';
import type { SearchToursQuery, TourDetailDto, TourListItemDto, TourManageDto } from './tours.types';
import { tourViewBuilder, type TourViewBuilder } from './tours.view';
import { enrichDestination, type DestinationDto } from './tours.destinations';

/** Public tour discovery: "Search tours", "Filter tours", "View tours list", "View tour details". */
export class ToursDiscoveryService {
  private readonly searchCache = new TtlCache<Page<TourListItemDto>>(30_000, 300);
  private readonly destinationsCache = new TtlCache<DestinationDto[]>(60_000, 10);
  private readonly detailCache = new TtlCache<TourDetailDto>(30_000, 500);

  constructor(
    private readonly tours: Pick<ToursRepository, 'searchPublic' | 'findById' | 'findManyByIds' | 'getPublicDestinations'> = toursRepository,
    private readonly views: Pick<TourViewBuilder, 'listItems' | 'publicDetail' | 'manage'> = tourViewBuilder,
  ) {}

  /** One endpoint serves search, filters and the plain list. Only APPROVED tours are ever returned. */
  async search(query: SearchToursQuery): Promise<Page<TourListItemDto>> {
    // Seat availability and supported age groups must reflect the latest booking/agency edit.
    if (query.adults || query.children || query.infants) {
      const { items, total } = await this.tours.searchPublic(query);
      return buildPage(await this.views.listItems(items), total, query);
    }
    const key = JSON.stringify(query);
    return this.searchCache.getOrCompute(key, async () => {
      const { items, total } = await this.tours.searchPublic(query);
      return buildPage(await this.views.listItems(items), total, query);
    });
  }

  /** Public cards for the given ids; ids that are not APPROVED (or do not exist) are simply absent from the map. */
  async getPublicCards(ids: string[]): Promise<Map<string, TourListItemDto>> {
    if (ids.length === 0) return new Map();
    const tours = (await this.tours.findManyByIds(Array.from(new Set(ids)))).filter((tour) => tour.status === TOUR_STATUS.APPROVED);
    const items = await this.views.listItems(tours);
    return new Map(items.map((item) => [item.id, item]));
  }

  /**
   * Visibility: APPROVED tours are public. Other statuses are visible only to the owning agency (not ARCHIVED) and to
   * staff allowed to list all tours; everybody else gets 404 so unpublished tours are not discoverable by id.
   */
  async getDetail(id: string, actor: Actor): Promise<TourDetailDto | TourManageDto> {
    const isPublicUser = actor.kind === 'guest' || actor.role === 'TRAVELER';
    if (isPublicUser) {
      return this.detailCache.getOrCompute(id, async () => {
        const tour = await this.tours.findById(id);
        if (!tour || tour.status !== TOUR_STATUS.APPROVED) throw AppError.notFound('Tour not found');
        return this.views.publicDetail(tour);
      });
    }

    const tour = await this.tours.findById(id);
    if (!tour) throw AppError.notFound('Tour not found');

    const isOwner = actor.kind === 'user' && tour.agencyId === actor.userId;
    const isStaff = actor.kind === 'user' && actor.permissions.includes(PERMISSIONS.TOUR_LIST_ALL);
    if (isStaff || isOwner) return this.views.manage(tour);
    if (tour.status === TOUR_STATUS.APPROVED) {
      return this.detailCache.getOrCompute(id, async () => this.views.publicDetail(tour));
    }
    throw AppError.notFound('Tour not found');
  }

  /** Returns list of active public destinations with tour counts and province characteristics. */
  async getDestinations(): Promise<DestinationDto[]> {
    return this.destinationsCache.getOrCompute('public_destinations', async () => {
      const raw = await this.tours.getPublicDestinations();
      return raw.map((item) => enrichDestination(item));
    });
  }

  /** Clears search and destination caches on mutations. */
  invalidateCache(id?: string): void {
    if (id) {
      this.detailCache.delete(id);
    } else {
      this.detailCache.clear();
    }
    this.searchCache.clear();
    this.destinationsCache.clear();
  }
}

export const toursDiscoveryService = new ToursDiscoveryService();
