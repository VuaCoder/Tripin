import { GUIDE_ASSIGNMENT_STATUS } from '@travel-platform/constants';
import { categoriesService, type CategoriesService } from '../categories';
import { usersService, type UsersService } from '../users';
import type { TourDocument } from './tours.model';
import { toGuideTourDto, toTourDetailDto, toTourListItemDto, toTourManageDto } from './tours.mapper';
import type { GuideTourDto, TourDetailDto, TourListItemDto, TourManageDto } from './tours.types';

/** Assembles tour DTOs: loads agency / guide / category info for the documents (batched, no N+1). */
export class TourViewBuilder {
  constructor(
    private readonly users: Pick<UsersService, 'getSummaries'> = usersService,
    private readonly categories: Pick<CategoriesService, 'getMany'> = categoriesService,
  ) {}

  async listItems(tours: TourDocument[]): Promise<TourListItemDto[]> {
    const people = await this.users.getSummaries(tours.map((tour) => String(tour.agencyId)));
    return tours.map((tour) => toTourListItemDto(tour, people.get(String(tour.agencyId))));
  }

  /** Public detail: only bookable departures; the guide is shown only after accepting the assignment. */
  async publicDetail(tour: TourDocument): Promise<TourDetailDto> {
    const guideId = tour.guide?.status === GUIDE_ASSIGNMENT_STATUS.ACCEPTED ? String(tour.guide.guideId) : undefined;
    const [people, categories] = await Promise.all([
      this.users.getSummaries([String(tour.agencyId), ...(guideId ? [guideId] : [])]),
      this.categories.getMany(tour.categoryIds.map(String)),
    ]);
    return toTourDetailDto(tour, {
      agency: people.get(String(tour.agencyId)),
      guide: guideId ? people.get(guideId) : undefined,
      categories,
      onlyBookable: true,
    });
  }

  /** Owner / moderator view: every departure, workflow fields and the guide assignment, whatever its answer. */
  async manage(tour: TourDocument): Promise<TourManageDto> {
    const guideId = tour.guide ? String(tour.guide.guideId) : undefined;
    const [people, categories] = await Promise.all([
      this.users.getSummaries([String(tour.agencyId), ...(guideId ? [guideId] : [])]),
      this.categories.getMany(tour.categoryIds.map(String)),
    ]);
    return toTourManageDto(tour, {
      agency: people.get(String(tour.agencyId)),
      guide: guideId ? people.get(guideId) : undefined,
      categories,
    });
  }

  /** List variant of `manage`: one users query and one categories query for the whole page. */
  async manageMany(tours: TourDocument[]): Promise<TourManageDto[]> {
    const personIds = tours.flatMap((tour) => [String(tour.agencyId), ...(tour.guide ? [String(tour.guide.guideId)] : [])]);
    const categoryIds = tours.flatMap((tour) => tour.categoryIds.map(String));
    const [people, categories] = await Promise.all([this.users.getSummaries(personIds), this.categories.getMany(categoryIds)]);
    const byCategory = new Map(categories.map((category) => [category.id, category]));
    return tours.map((tour) =>
      toTourManageDto(tour, {
        agency: people.get(String(tour.agencyId)),
        guide: tour.guide ? people.get(String(tour.guide.guideId)) : undefined,
        categories: tour.categoryIds.map((id) => byCategory.get(String(id))).filter((c): c is NonNullable<typeof c> => !!c),
      }),
    );
  }

  async guideItems(tours: TourDocument[]): Promise<GuideTourDto[]> {
    const people = await this.users.getSummaries(tours.map((tour) => String(tour.agencyId)));
    return tours.filter((tour) => tour.guide).map((tour) => toGuideTourDto(tour, people.get(String(tour.agencyId))));
  }
}

export const tourViewBuilder = new TourViewBuilder();
