import { baseApi } from '@/store/api/baseApi';
import type { ReviewItemResponse, ReviewListResponse, PublicReview, ReviewSort, TourReviewsPage } from '@/features/review/types';

export interface PublicProfile {
  id: string;
  fullName: string;
  avatarUrl?: string;
  companyName?: string;
  description?: string;
  address?: string;
  website?: string;
  verified?: boolean;
  bio?: string;
  languages?: string[];
  specialties?: string[];
  experienceYears?: number;
}
export type ProfileKind = 'agency' | 'guide';
export const publicProfilesApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getPublicProfile: build.query<PublicProfile, { kind: ProfileKind; id: string }>({
      query: ({ kind, id }) => `/${kind === 'agency' ? 'agencies' : 'tour-guides'}/${id}`,
      transformResponse: (response: ReviewItemResponse<PublicProfile>) => response.data,
    }),
    getProfileReviews: build.query<TourReviewsPage, { kind: ProfileKind; id: string; page: number; sort: ReviewSort }>({
      query: ({ kind, id, page, sort }) => ({ url: '/reviews', params: { [kind === 'agency' ? 'agencyId' : 'guideId']: id, page, sort, limit: 10 } }),
      transformResponse: (response: ReviewListResponse<PublicReview>) => ({ items: response.data, meta: response.meta }),
      providesTags: ['Review'],
    }),
  }),
});
export const { useGetPublicProfileQuery, useGetProfileReviewsQuery } = publicProfilesApi;
