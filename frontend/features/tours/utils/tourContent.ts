import type { TourContentInput, TourDetail } from '../types';

/** The editor form value for a tour. One mapping for the full agency editor and the chat offer panel. */
export function toTourContentInput(tour: TourDetail): TourContentInput {
  return {
    title: tour.title ?? '',
    summary: tour.summary ?? '',
    description: tour.description ?? '',
    destination: tour.destination ?? '',
    durationDays: tour.durationDays ?? 1,
    basePrice: tour.basePrice ?? 0,
    maxGroupSize: tour.maxGroupSize,
    categoryIds: tour.categoryIds ? [...tour.categoryIds].sort() : [],
    images: tour.images && tour.images.length > 0 ? [...tour.images] : (tour.coverImage ? [tour.coverImage] : []),
    inclusions: tour.inclusions ? [...tour.inclusions] : [],
    exclusions: tour.exclusions ? [...tour.exclusions] : [],
    agePricing: tour.agePricing ?? null,
    childPricingPolicy: tour.childPricingPolicy ?? '',
    cancellationPolicy: tour.cancellationPolicy ?? '',
    travelNotes: tour.travelNotes ?? '',
    requiredDocuments: tour.requiredDocuments ?? '',
  };
}
