import type { TransitionMap } from '../../utils/state-machine';

export const REVIEW_STATUS = {
  VISIBLE: 'VISIBLE',
  /** Removed from public view by a moderator. */
  HIDDEN: 'HIDDEN',
} as const;
export type ReviewStatus = (typeof REVIEW_STATUS)[keyof typeof REVIEW_STATUS];

const S = REVIEW_STATUS;
/** Moderators can hide a review and restore it. */
export const REVIEW_TRANSITIONS: TransitionMap<ReviewStatus> = {
  [S.VISIBLE]: [S.HIDDEN],
  [S.HIDDEN]: [S.VISIBLE],
};

export type ReviewSort = 'newest' | 'rating_desc' | 'rating_asc';

export interface CreateReviewInput {
  bookingId: string;
  rating: number;
  comment: string;
}

export interface ListPublicReviewsQuery {
  page: number;
  limit: number;
  tourId?: string;
  agencyId?: string;
  sort: ReviewSort;
}

export interface ListModerationReviewsQuery {
  page: number;
  limit: number;
  status?: ReviewStatus;
  tourId?: string;
}

/** Public representation: author shown as "First L." only, no ids of the traveler. */
export interface PublicReviewDto {
  id: string;
  rating: number;
  comment: string;
  tourId: string;
  author: { name: string; avatarUrl?: string };
  createdAt: string;
}

/** The author's own view (includes moderation state). */
export interface MyReviewDto {
  id: string;
  bookingId: string;
  tourId: string;
  tourTitle: string;
  rating: number;
  comment: string;
  status: ReviewStatus;
  hiddenReason?: string;
  createdAt: string;
}

/** Moderator view. */
export interface ModerationReviewDto extends MyReviewDto {
  travelerId: string;
  agencyId: string;
  moderatedAt?: string;
  moderatedBy?: string;
}
