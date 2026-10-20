/** Wire shapes of `/agency/review-disputes` and the public review list an agency reads (`GET /reviews?agencyId=`). */

import type { MyReport } from '@/features/report/types';
import type { PublicReview } from '@/features/review/types';

/** A visible review of one of the agency's tours. The author is masked by the backend. */
export type AgencyReview = PublicReview;

/** A dispute is an ordinary report filed by the agency: `targetType` is always `REVIEW`. */
export type ReviewDispute = MyReport;

export interface AgencyReviewsPageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AgencyReviewsListResult<T> {
  items: T[];
  meta: AgencyReviewsPageMeta;
}

export interface AgencyReviewsApiResponse<T> {
  success: boolean;
  data: T;
  meta?: AgencyReviewsPageMeta;
  error?: { code: string; message: string; details?: unknown };
}

export interface ListAgencyReviewsArgs {
  page?: number;
  limit?: number;
}

export interface ListDisputesArgs {
  page?: number;
  limit?: number;
}

/** Exactly what `POST /agency/review-disputes/:reviewId` accepts. */
export interface DisputeReviewInput {
  reviewId: string;
  category: MyReport['category'];
  description: string;
}
