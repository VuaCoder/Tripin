import { PERMISSIONS, TOUR_STATUS } from '@travel-platform/constants';
import type { Actor } from '../../types/actor';
import { AppError } from '../../utils/app-error';
import { buildPage, type Page } from '../../utils/pagination';
import { toursRepository, type ToursRepository } from './tours.repository';
import type { SearchToursQuery, TourDetailDto, TourListItemDto, TourManageDto } from './tours.types';
import { tourViewBuilder, type TourViewBuilder } from './tours.view';

/** Public tour discovery: "Search tours", "Filter tours", "View tours list", "View tour details". */
export class ToursDiscoveryService {
  constructor(
    private readonly tours: Pick<ToursRepository, 'searchPublic' | 'findById' | 'findManyByIds'> = toursRepository,
    private readonly views: Pick<TourViewBuilder, 'listItems' | 'publicDetail' | 'manage'> = tourViewBuilder,
  ) {}

  /** One endpoint serves search, filters and the plain list. Only APPROVED tours are ever returned. */
  async search(query: SearchToursQuery): Promise<Page<TourListItemDto>> {
    const { items, total } = await this.tours.searchPublic(query);
    return buildPage(await this.views.listItems(items), total, query);
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
    const tour = await this.tours.findById(id);
    if (!tour) throw AppError.notFound('Tour not found');

    if (tour.status === TOUR_STATUS.APPROVED && actor.kind === 'guest') return this.views.publicDetail(tour);

    const isOwner = actor.kind === 'user' && String(tour.agencyId) === actor.userId;
    const isStaff = actor.kind === 'user' && actor.permissions.includes(PERMISSIONS.TOUR_LIST_ALL);
    if (isStaff || (isOwner && tour.status !== TOUR_STATUS.ARCHIVED)) return this.views.manage(tour);
    if (tour.status === TOUR_STATUS.APPROVED) return this.views.publicDetail(tour);
    throw AppError.notFound('Tour not found');
  }
}

export const toursDiscoveryService = new ToursDiscoveryService();
