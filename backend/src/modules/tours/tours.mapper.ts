import type { TourStatus } from '@travel-platform/constants';
import type { CategoryDto } from '../categories';
import type { UserSummary } from '../users';
import type { TourRecord } from './tours.repository';
import type {
  DepartureDto,
  GuideTourDto,
  TourAgencyDto,
  TourDetailDto,
  TourListItemDto,
  TourManageDto,
} from './tours.types';

const iso = (date?: Date | null) => date?.toISOString();

type DepartureLike = TourRecord['departures'][number];

export function departurePrice(tour: Pick<TourRecord, 'basePrice'>, departure: Pick<DepartureLike, 'priceOverride'>): number {
  return departure.priceOverride ?? tour.basePrice;
}

/** A departure customers can still book right now. */
export function isBookable(departure: Pick<DepartureLike, 'isOpen' | 'date' | 'remaining'>, now = new Date()): boolean {
  return departure.isOpen && departure.date.getTime() > now.getTime() && departure.remaining > 0;
}

export function nextDepartureDate(tour: Pick<TourRecord, 'departures'>): string | undefined {
  const upcoming = tour.departures.filter((d) => isBookable(d)).sort((a, b) => a.date.getTime() - b.date.getTime());
  return iso(upcoming[0]?.date);
}

export function toDepartureDto(tour: Pick<TourRecord, 'basePrice'>, departure: DepartureLike): DepartureDto {
  return {
    id: departure.id,
    date: departure.date.toISOString(),
    capacity: departure.capacity,
    remaining: departure.remaining,
    price: departurePrice(tour, departure),
    isOpen: departure.isOpen,
  };
}

const toAgencyDto = (summary?: UserSummary): TourAgencyDto | undefined =>
  summary ? { id: summary.id, name: summary.fullName, avatarUrl: summary.avatarUrl } : undefined;

export function toTourListItemDto(tour: TourRecord, agency?: UserSummary): TourListItemDto {
  return {
    id: tour.id,
    title: tour.title,
    summary: tour.summary ?? undefined,
    destination: tour.destination,
    durationDays: tour.durationDays,
    basePrice: tour.basePrice,
    coverImage: tour.images[0],
    categoryIds: tour.categoryIds,
    ratingAvg: tour.ratingAvg,
    ratingCount: tour.ratingCount,
    nextDepartureDate: nextDepartureDate(tour),
    agency: toAgencyDto(agency),
  };
}

interface DetailContext {
  agency?: UserSummary;
  categories: CategoryDto[];
  guide?: UserSummary;
  /** Public detail only lists departures that can still be booked; the manage view lists all. */
  onlyBookable: boolean;
}

export function toTourDetailDto(tour: TourRecord, context: DetailContext): TourDetailDto {
  const departures = tour.departures.filter((d) => !context.onlyBookable || isBookable(d));
  return {
    ...toTourListItemDto(tour, context.agency),
    description: tour.description ?? undefined,
    maxGroupSize: tour.maxGroupSize ?? undefined,
    images: tour.images,
    inclusions: tour.inclusions,
    exclusions: tour.exclusions,
    itinerary: [...tour.itinerary]
      .sort((a, b) => a.day - b.day)
      .map((day) => ({ day: day.day, title: day.title, description: day.description ?? undefined, activities: day.activities })),
    departures: departures.sort((a, b) => a.date.getTime() - b.date.getTime()).map((d) => toDepartureDto(tour, d)),
    categories: context.categories,
    guide: context.guide ? { id: context.guide.id, fullName: context.guide.fullName, avatarUrl: context.guide.avatarUrl } : undefined,
  };
}

export function toTourManageDto(tour: TourRecord, context: Omit<DetailContext, 'onlyBookable'>): TourManageDto {
  const assignment = tour.guide;
  return {
    ...toTourDetailDto(tour, { ...context, onlyBookable: false }),
    status: tour.status as TourStatus,
    statusReason: tour.statusReason ?? undefined,
    submittedAt: iso(tour.submittedAt),
    reviewedAt: iso(tour.reviewedAt),
    createdAt: tour.createdAt.toISOString(),
    updatedAt: tour.updatedAt.toISOString(),
    guideAssignment: assignment
      ? {
          guideId: assignment.guideId,
          feePerBooking: assignment.feePerBooking,
          status: assignment.status as NonNullable<TourManageDto['guideAssignment']>['status'],
          respondedAt: iso(assignment.respondedAt),
          note: assignment.note ?? undefined,
        }
      : undefined,
  };
}

export function toGuideTourDto(tour: TourRecord, agency?: UserSummary): GuideTourDto {
  const assignment = tour.guide!;
  return {
    id: tour.id,
    title: tour.title,
    destination: tour.destination,
    durationDays: tour.durationDays,
    tourStatus: tour.status as TourStatus,
    agencyId: tour.agencyId,
    agency: toAgencyDto(agency),
    assignment: {
      feePerBooking: assignment.feePerBooking,
      status: assignment.status as GuideTourDto['assignment']['status'],
      respondedAt: iso(assignment.respondedAt),
    },
    nextDepartureDate: nextDepartureDate(tour),
  };
}
