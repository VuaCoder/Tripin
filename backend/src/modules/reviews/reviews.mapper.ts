import type { ReviewDocument } from './reviews.model';
import type { ModerationReviewDto, MyReviewDto, PublicReviewDto, ReviewStatus } from './reviews.types';

const createdAtOf = (review: ReviewDocument) => (review as unknown as { createdAt: Date }).createdAt.toISOString();

/** "Nguyen Van An" -> "Nguyen A." — enough for trust, not enough to identify someone. */
export function maskName(fullName: string | undefined): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Traveler';
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]} ${parts[parts.length - 1]![0]!.toUpperCase()}.`;
}

export function toPublicReviewDto(review: ReviewDocument, author?: { fullName: string; avatarUrl?: string }): PublicReviewDto {
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    tourId: String(review.tourId),
    author: { name: maskName(author?.fullName), avatarUrl: author?.avatarUrl },
    createdAt: createdAtOf(review),
  };
}

export function toMyReviewDto(review: ReviewDocument): MyReviewDto {
  return {
    id: review.id,
    bookingId: String(review.bookingId),
    tourId: String(review.tourId),
    tourTitle: review.tourTitle,
    rating: review.rating,
    comment: review.comment,
    status: review.status as ReviewStatus,
    hiddenReason: review.hiddenReason ?? undefined,
    createdAt: createdAtOf(review),
  };
}

export function toModerationReviewDto(review: ReviewDocument): ModerationReviewDto {
  return {
    ...toMyReviewDto(review),
    travelerId: String(review.travelerId),
    agencyId: String(review.agencyId),
    moderatedAt: review.moderatedAt?.toISOString(),
    moderatedBy: review.moderatedBy ? String(review.moderatedBy) : undefined,
  };
}
