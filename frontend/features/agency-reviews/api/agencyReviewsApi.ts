import { baseApi } from '@/store/api/baseApi';
import type {
  AgencyReview,
  AgencyReviewsApiResponse,
  AgencyReviewsListResult,
  DisputeReviewInput,
  ListAgencyReviewsArgs,
  ListDisputesArgs,
  ReviewDispute,
} from '../types';

function toList<T>(response: AgencyReviewsApiResponse<T[]>): AgencyReviewsListResult<T> {
  return {
    items: response.data,
    meta: response.meta ?? { page: 1, limit: response.data.length || 10, total: response.data.length, totalPages: 1 },
  };
}

const DISPUTES_TAG = { type: 'Report', id: 'AGENCY_DISPUTES' } as const;

/** Agency endpoints: the reviews of its own tours, and the disputes it filed about them (use case "Dispute a review"). */
export const agencyReviewsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** `GET /reviews?agencyId=` — the VISIBLE reviews of this agency, newest first. */
    getAgencyReviews: build.query<AgencyReviewsListResult<AgencyReview>, ListAgencyReviewsArgs & { agencyId: string }>({
      query: ({ agencyId, page = 1, limit = 10 }) => ({ url: '/reviews', params: { agencyId, page, limit } }),
      transformResponse: (response: AgencyReviewsApiResponse<AgencyReview[]>) => toList(response),
      providesTags: [{ type: 'Review', id: 'AGENCY' }],
    }),

    /** `POST /agency/review-disputes/:reviewId` — flags a review of one of its own tours as untrue. */
    disputeReview: build.mutation<ReviewDispute, DisputeReviewInput>({
      query: ({ reviewId, category, description }) => ({
        url: `/agency/review-disputes/${reviewId}`,
        method: 'POST',
        body: { category, description },
      }),
      transformResponse: (response: AgencyReviewsApiResponse<ReviewDispute>) => response.data,
      invalidatesTags: [DISPUTES_TAG],
    }),

    /** The disputes this agency filed, with the moderator's outcome. */
    getMyReviewDisputes: build.query<AgencyReviewsListResult<ReviewDispute>, ListDisputesArgs | void>({
      query: (args) => ({ url: '/agency/review-disputes', params: { page: 1, limit: 10, ...(args ?? {}) } }),
      transformResponse: (response: AgencyReviewsApiResponse<ReviewDispute[]>) => toList(response),
      providesTags: [DISPUTES_TAG],
    }),
  }),
  overrideExisting: false,
});

export const { useGetAgencyReviewsQuery, useDisputeReviewMutation, useGetMyReviewDisputesQuery } = agencyReviewsApi;
