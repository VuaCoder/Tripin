import { baseApi } from '@/store/api/baseApi';
import type {
  BanAccountInput,
  ListModerationAgenciesArgs,
  ListModerationReportsArgs,
  ListModerationReviewsArgs,
  ListModerationTicketsArgs,
  ListModerationToursArgs,
  ModerateReviewInput,
  ModerationAgency,
  ModerationApiResponse,
  ModerationDashboard,
  ModerationListResult,
  ModerationReport,
  ModerationReview,
  ModerationTicket,
  ModerationTicketSummary,
  ModerationTour,
  ResolveReportInput,
  SuspendTourInput,
  TicketReplyInput,
  TicketStatusInput,
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
const REPORTS_TAG = { type: 'Report', id: 'MODERATION' } as const;
const REVIEWS_TAG = { type: 'Review', id: 'MODERATION' } as const;
const TICKETS_TAG = { type: 'SupportTicket', id: 'MODERATION' } as const;

/** Moderator endpoints mounted at `/api/v1/moderation` (dashboard, tours, agencies, disputes, reviews, complaints, bans). */
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

    /** Use case "Resolve disputes": the reports queue, open items first (the backend decides the order). */
    getModerationReports: build.query<ModerationListResult<ModerationReport>, ListModerationReportsArgs | void>({
      query: (args) => ({ url: '/moderation/reports', params: { page: 1, limit: 10, ...(args ?? {}) } }),
      transformResponse: (r: ModerationApiResponse<ModerationReport[]>) => toList(r),
      providesTags: [REPORTS_TAG],
    }),

    resolveReport: build.mutation<ModerationReport, ResolveReportInput>({
      query: ({ id, decision, note }) => ({ url: `/moderation/reports/${id}/resolve`, method: 'POST', body: { decision, note } }),
      transformResponse: (r: ModerationApiResponse<ModerationReport>) => unwrap(r),
      invalidatesTags: [REPORTS_TAG, DASHBOARD_TAG],
    }),

    /** Use case "Moderate reviews". */
    getModerationReviews: build.query<ModerationListResult<ModerationReview>, ListModerationReviewsArgs | void>({
      query: (args) => ({ url: '/moderation/reviews', params: { page: 1, limit: 10, ...(args ?? {}) } }),
      transformResponse: (r: ModerationApiResponse<ModerationReview[]>) => toList(r),
      providesTags: [REVIEWS_TAG],
    }),

    moderateReview: build.mutation<ModerationReview, ModerateReviewInput>({
      query: ({ id, hide, reason }) => ({
        url: `/moderation/reviews/${id}/moderate`,
        method: 'POST',
        body: { hide, ...(reason ? { reason } : {}) },
      }),
      transformResponse: (r: ModerationApiResponse<ModerationReview>) => unwrap(r),
      // Hiding a review also changes the public list of its tour, the tour's recomputed rating, and the report
      // queue — a dispute about that review must show the new status without a reload.
      invalidatesTags: (result) =>
        result
          ? [REVIEWS_TAG, DASHBOARD_TAG, REPORTS_TAG, { type: 'Review', id: `TOUR-${result.tourId}` }, { type: 'Tour', id: result.tourId }]
          : [REVIEWS_TAG, DASHBOARD_TAG, REPORTS_TAG],
    }),

    /** Use case "Handle complaints": the support queue. */
    getModerationTickets: build.query<ModerationListResult<ModerationTicketSummary>, ListModerationTicketsArgs | void>({
      query: (args) => ({ url: '/moderation/support-tickets', params: { page: 1, limit: 10, ...(args ?? {}) } }),
      transformResponse: (r: ModerationApiResponse<ModerationTicketSummary[]>) => toList(r),
      providesTags: [TICKETS_TAG],
    }),

    /** The list row has no conversation, so the detail is read on selection. */
    getModerationTicket: build.query<ModerationTicket, string>({
      query: (id) => ({ url: `/moderation/support-tickets/${id}` }),
      transformResponse: (r: ModerationApiResponse<ModerationTicket>) => unwrap(r),
      providesTags: (result, error, id) => [{ type: 'SupportTicket', id }],
    }),

    replyToModerationTicket: build.mutation<ModerationTicket, TicketReplyInput>({
      query: ({ id, text, resolve }) => ({
        url: `/moderation/support-tickets/${id}/reply`,
        method: 'POST',
        body: { text, ...(resolve ? { resolve: true } : {}) },
      }),
      transformResponse: (r: ModerationApiResponse<ModerationTicket>) => unwrap(r),
      invalidatesTags: (result, error, { id }) => [TICKETS_TAG, { type: 'SupportTicket', id }, DASHBOARD_TAG],
    }),

    setModerationTicketStatus: build.mutation<ModerationTicket, TicketStatusInput>({
      query: ({ id, status }) => ({ url: `/moderation/support-tickets/${id}/status`, method: 'PATCH', body: { status } }),
      transformResponse: (r: ModerationApiResponse<ModerationTicket>) => unwrap(r),
      invalidatesTags: (result, error, { id }) => [TICKETS_TAG, { type: 'SupportTicket', id }, DASHBOARD_TAG],
    }),

    /** Use case "Ban violating account". The backend owns the rules (no self, no super admin, staff only by one). */
    banAccount: build.mutation<{ id: string; status: string }, BanAccountInput>({
      query: ({ id, reason }) => ({ url: `/moderation/users/${id}/ban`, method: 'POST', body: { reason } }),
      transformResponse: (r: ModerationApiResponse<{ id: string; status: string }>) => unwrap(r),
      invalidatesTags: [DASHBOARD_TAG],
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
  useGetModerationReportsQuery,
  useResolveReportMutation,
  useGetModerationReviewsQuery,
  useModerateReviewMutation,
  useGetModerationTicketsQuery,
  useGetModerationTicketQuery,
  useReplyToModerationTicketMutation,
  useSetModerationTicketStatusMutation,
  useBanAccountMutation,
} = moderationApi;
