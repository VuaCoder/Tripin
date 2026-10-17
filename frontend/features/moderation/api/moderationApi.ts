import { baseApi } from '@/store/api/baseApi';
import type {
  ListModerationAgenciesArgs,
  ListModerationToursArgs,
  ModerationAgency,
  ModerationApiResponse,
  ModerationDashboard,
  ModerationListResult,
  ModerationTour,
  SuspendTourInput,
  ValidateTourInput,
  VerifyAgencyInput,
} from '../types';

function toList<T>(response: ModerationApiResponse<T[]>): ModerationListResult<T> {
  return {
    items: response.data,
    meta: response.meta ?? { page: 1, limit: response.data.length || 10, total: response.data.length, totalPages: 1 },
  };
}

function unwrap<T>(response: ModerationApiResponse<T>): T {
  return response.data;
}

const DASHBOARD_TAG = { type: 'Moderation', id: 'DASHBOARD' } as const;
const TOURS_TAG = { type: 'Moderation', id: 'TOURS' } as const;
const AGENCIES_TAG = { type: 'Moderation', id: 'AGENCIES' } as const;

/** Moderator endpoints mounted at `/api/v1/moderation` (dashboard, tour lists, validate/suspend tour, verify agency). */
export const moderationApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getModerationDashboard: build.query<ModerationDashboard, void>({
      query: () => ({ url: '/moderation/dashboard' }),
      transformResponse: (r: ModerationApiResponse<ModerationDashboard>) => unwrap(r),
      providesTags: [DASHBOARD_TAG],
    }),

    getModerationTours: build.query<ModerationListResult<ModerationTour>, ListModerationToursArgs | void>({
      query: (args) => ({ url: '/moderation/tours', params: { page: 1, limit: 10, ...(args ?? {}) } }),
      transformResponse: (r: ModerationApiResponse<ModerationTour[]>) => toList(r),
      providesTags: [TOURS_TAG],
    }),

    validateTour: build.mutation<ModerationTour, ValidateTourInput>({
      query: ({ id, approve, reason }) => ({
        url: `/moderation/tours/${id}/validate`,
        method: 'POST',
        body: { approve, ...(reason ? { reason } : {}) },
      }),
      transformResponse: (r: ModerationApiResponse<ModerationTour>) => unwrap(r),
      invalidatesTags: [TOURS_TAG, DASHBOARD_TAG],
    }),

    suspendTour: build.mutation<ModerationTour, SuspendTourInput>({
      query: ({ id, reason }) => ({ url: `/moderation/tours/${id}/suspend`, method: 'POST', body: { reason } }),
      transformResponse: (r: ModerationApiResponse<ModerationTour>) => unwrap(r),
      invalidatesTags: [TOURS_TAG, DASHBOARD_TAG],
    }),

    getModerationAgencies: build.query<ModerationListResult<ModerationAgency>, ListModerationAgenciesArgs | void>({
      query: (args) => ({ url: '/moderation/agencies', params: { page: 1, limit: 10, ...(args ?? {}) } }),
      transformResponse: (r: ModerationApiResponse<ModerationAgency[]>) => toList(r),
      providesTags: [AGENCIES_TAG],
    }),

    verifyAgency: build.mutation<ModerationAgency, VerifyAgencyInput>({
      query: ({ id, approve, note }) => ({
        url: `/moderation/agencies/${id}/verify`,
        method: 'POST',
        body: { approve, ...(note ? { note } : {}) },
      }),
      transformResponse: (r: ModerationApiResponse<ModerationAgency>) => unwrap(r),
      invalidatesTags: [AGENCIES_TAG, DASHBOARD_TAG],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetModerationDashboardQuery,
  useGetModerationToursQuery,
  useValidateTourMutation,
  useSuspendTourMutation,
  useGetModerationAgenciesQuery,
  useVerifyAgencyMutation,
} = moderationApi;
