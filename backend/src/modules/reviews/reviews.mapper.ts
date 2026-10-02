import type { ReviewRecord } from './reviews.repository';
import type { ModerationReviewDto, MyReviewDto, PublicReviewDto, ReviewStatus } from './reviews.types';

const createdAtOf = (review: ReviewRecord) => review.createdAt.toISOString();

/** "Nguyen Van An" -> "Nguyen A." — enough for trust, not enough to identify someone. */
export function maskName(fullName: string | undefined): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Traveler';
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]} ${parts[parts.length - 1]![0]!.toUpperCase()}.`;
}

export function toPublicReviewDto(review: ReviewRecord, author?: { fullName: string; avatarUrl?: string }): PublicReviewDto {
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    tourId: review.tourId,
    author: { name: maskName(author?.fullName), avatarUrl: author?.avatarUrl },
    createdAt: createdAtOf(review),
  };
}

export function toMyReviewDto(review: ReviewRecord): MyReviewDto {
  return {
    id: review.id,
    bookingId: review.bookingId,
    tourId: review.tourId,
    tourTitle: review.tourTitle,
    rating: review.rating,
    comment: review.comment,
    status: review.status as ReviewStatus,
    hiddenReason: review.hiddenReason ?? undefined,
    createdAt: createdAtOf(review),
  };
}

export function toModerationReviewDto(review: ReviewRecord): ModerationReviewDto {
  return {
    ...toMyReviewDto(review),
    travelerId: review.travelerId,
    agencyId: review.agencyId,
    moderatedAt: review.moderatedAt?.toISOString(),
    moderatedBy: review.moderatedById ?? undefined,
  };
}
