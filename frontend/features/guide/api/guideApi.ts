import { baseApi } from '@/store/api/baseApi';
import type {
  AnswerAssignmentInput,
  GuideApiResponse,
  GuideAssignedTour,
  GuideTourListResult,
  ListAssignedToursArgs,
} from '../types';

/** Tour-guide endpoints mounted at `/api/v1/guide/tours` (profile lives in `features/traveler-account/api/profileApi`). */
export const guideApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAssignedTours: build.query<GuideTourListResult, ListAssignedToursArgs | void>({
      query: (args) => ({ url: '/guide/tours', params: { page: 1, limit: 10, ...(args ?? {}) } }),
      transformResponse: (response: GuideApiResponse<GuideAssignedTour[]>) => ({
        items: response.data,
        meta: response.meta ?? { page: 1, limit: response.data.length || 10, total: response.data.length, totalPages: 1 },
      }),
      providesTags: [{ type: 'Tour', id: 'GUIDE_ASSIGNED' }],
    }),

    answerAssignment: build.mutation<GuideAssignedTour, AnswerAssignmentInput>({
      query: ({ tourId, accept, note }) => ({
        url: `/guide/tours/${tourId}/verification`,
        method: 'POST',
        body: { accept, ...(note ? { note } : {}) },
      }),
      transformResponse: (response: GuideApiResponse<GuideAssignedTour>) => response.data,
      invalidatesTags: (_result, _error, { tourId }) => [{ type: 'Tour', id: 'GUIDE_ASSIGNED' }, { type: 'Tour', id: tourId }, { type: 'Tour', id: 'AGENCY_LIST' }],
    }),
  }),
  overrideExisting: false,
});

export const { useGetAssignedToursQuery, useAnswerAssignmentMutation } = guideApi;
