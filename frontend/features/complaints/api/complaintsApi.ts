import { baseApi } from '@/store/api/baseApi';
import type { ImageUploadSignature } from '@/features/traveler-account/types';
import type {
  AdjudicateComplaintTicketInput,
  AgencyQualityStats,
  ComplaintFeedback,
  ComplaintListResult,
  ComplaintTicketDetail,
  ComplaintTicketMessage,
  ComplaintTicketSummary,
  CreateComplaintTicketInput,
  EscalateComplaintTicketInput,
  ListComplaintsArgs,
  ResolveComplaintTicketInput,
  SendComplaintMessageInput,
  SubmitComplaintFeedbackInput,
} from '../types';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface PaginatedApiResponse<T> {
  success: boolean;
  items?: T[];
  data?: T[];
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const normalizeListResponse = (res: PaginatedApiResponse<ComplaintTicketSummary>): ComplaintListResult => {
  const items = Array.isArray(res.items) ? res.items : Array.isArray(res.data) ? res.data : [];
  const meta = res.meta ?? {
    page: 1,
    limit: items.length || 10,
    total: items.length,
    totalPages: 1,
  };
  return { items, meta };
};

const COMPLAINT_TAG = 'Complaint' as const;

export const complaintsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // Cloudinary Signature
    createComplaintImageSignature: build.mutation<ImageUploadSignature, { role?: 'TRAVELER' | 'AGENCY' | 'MODERATOR' } | void>({
      query: (args) => {
        const role = args?.role ?? 'TRAVELER';
        const url =
          role === 'AGENCY'
            ? '/agency/complaint-tickets/images/upload-signature'
            : role === 'MODERATOR'
            ? '/moderation/complaint-tickets/images/upload-signature'
            : '/complaints/images/upload-signature';
        return { url, method: 'POST' };
      },
      transformResponse: (res: ApiResponse<ImageUploadSignature>) => res.data,
    }),

    // Traveler
    createComplaintTicket: build.mutation<ComplaintTicketSummary, CreateComplaintTicketInput>({
      query: (body) => ({ url: '/complaints', method: 'POST', body }),
      transformResponse: (res: ApiResponse<ComplaintTicketSummary>) => res.data,
      invalidatesTags: [{ type: COMPLAINT_TAG, id: 'LIST_TRAVELER' }],
    }),

    getMyComplaints: build.query<ComplaintListResult, ListComplaintsArgs | void>({
      query: (args) => ({
        url: '/complaints/me',
        params: { page: 1, limit: 10, ...(args ?? {}) },
      }),
      transformResponse: (res: PaginatedApiResponse<ComplaintTicketSummary>) => normalizeListResponse(res),
      providesTags: [{ type: COMPLAINT_TAG, id: 'LIST_TRAVELER' }],
    }),

    getComplaintDetail: build.query<ComplaintTicketDetail, string>({
      query: (id) => `/complaints/${id}`,
      transformResponse: (res: ApiResponse<ComplaintTicketDetail>) => res.data,
      providesTags: (_result, _err, id) => [{ type: COMPLAINT_TAG, id }],
    }),

    sendComplaintMessage: build.mutation<ComplaintTicketMessage, SendComplaintMessageInput>({
      query: ({ ticketId, ...body }) => ({
        url: `/complaints/${ticketId}/messages`,
        method: 'POST',
        body,
      }),
      transformResponse: (res: ApiResponse<ComplaintTicketMessage>) => res.data,
      invalidatesTags: (_result, _err, { ticketId }) => [
        { type: COMPLAINT_TAG, id: ticketId },
        { type: COMPLAINT_TAG, id: 'LIST_TRAVELER' },
        { type: COMPLAINT_TAG, id: 'LIST_AGENCY' },
      ],
    }),

    acceptResolution: build.mutation<ComplaintTicketDetail, string>({
      query: (ticketId) => ({
        url: `/complaints/${ticketId}/accept-resolution`,
        method: 'POST',
      }),
      transformResponse: (res: ApiResponse<ComplaintTicketDetail>) => res.data,
      invalidatesTags: (_result, _err, ticketId) => [
        { type: COMPLAINT_TAG, id: ticketId },
        { type: COMPLAINT_TAG, id: 'LIST_TRAVELER' },
        { type: COMPLAINT_TAG, id: 'LIST_AGENCY' },
      ],
    }),

    escalateComplaint: build.mutation<ComplaintTicketDetail, EscalateComplaintTicketInput>({
      query: ({ ticketId, ...body }) => ({
        url: `/complaints/${ticketId}/escalate`,
        method: 'POST',
        body,
      }),
      transformResponse: (res: ApiResponse<ComplaintTicketDetail>) => res.data,
      invalidatesTags: (_result, _err, { ticketId }) => [
        { type: COMPLAINT_TAG, id: ticketId },
        { type: COMPLAINT_TAG, id: 'LIST_TRAVELER' },
        { type: COMPLAINT_TAG, id: 'LIST_AGENCY' },
        { type: COMPLAINT_TAG, id: 'LIST_MODERATOR' },
      ],
    }),

    submitComplaintFeedback: build.mutation<ComplaintFeedback, SubmitComplaintFeedbackInput>({
      query: ({ ticketId, ...body }) => ({
        url: `/complaints/${ticketId}/feedback`,
        method: 'POST',
        body,
      }),
      transformResponse: (res: ApiResponse<ComplaintFeedback>) => res.data,
      invalidatesTags: (_result, _err, { ticketId }) => [
        { type: COMPLAINT_TAG, id: ticketId },
        { type: COMPLAINT_TAG, id: 'LIST_TRAVELER' },
        { type: COMPLAINT_TAG, id: 'DASHBOARD_QUALITY' },
      ],
    }),

    // Agency
    getAgencyComplaints: build.query<ComplaintListResult, ListComplaintsArgs | void>({
      query: (args) => ({
        url: '/agency/complaint-tickets',
        params: { page: 1, limit: 10, ...(args ?? {}) },
      }),
      transformResponse: (res: PaginatedApiResponse<ComplaintTicketSummary>) => normalizeListResponse(res),
      providesTags: [{ type: COMPLAINT_TAG, id: 'LIST_AGENCY' }],
    }),

    resolveComplaintTicket: build.mutation<ComplaintTicketDetail, ResolveComplaintTicketInput>({
      query: ({ ticketId, ...body }) => ({
        url: `/agency/complaint-tickets/${ticketId}/resolve`,
        method: 'POST',
        body,
      }),
      transformResponse: (res: ApiResponse<ComplaintTicketDetail>) => res.data,
      invalidatesTags: (_result, _err, { ticketId }) => [
        { type: COMPLAINT_TAG, id: ticketId },
        { type: COMPLAINT_TAG, id: 'LIST_TRAVELER' },
        { type: COMPLAINT_TAG, id: 'LIST_AGENCY' },
      ],
    }),

    // Moderator
    getModeratorComplaints: build.query<ComplaintListResult, ListComplaintsArgs | void>({
      query: (args) => ({
        url: '/moderation/complaint-tickets',
        params: { page: 1, limit: 10, ...(args ?? {}) },
      }),
      transformResponse: (res: PaginatedApiResponse<ComplaintTicketSummary>) => normalizeListResponse(res),
      providesTags: [{ type: COMPLAINT_TAG, id: 'LIST_MODERATOR' }],
    }),

    adjudicateComplaintTicket: build.mutation<ComplaintTicketDetail, AdjudicateComplaintTicketInput>({
      query: ({ ticketId, ...body }) => ({
        url: `/moderation/complaint-tickets/${ticketId}/adjudicate`,
        method: 'POST',
        body,
      }),
      transformResponse: (res: ApiResponse<ComplaintTicketDetail>) => res.data,
      invalidatesTags: (_result, _err, { ticketId }) => [
        { type: COMPLAINT_TAG, id: ticketId },
        { type: COMPLAINT_TAG, id: 'LIST_TRAVELER' },
        { type: COMPLAINT_TAG, id: 'LIST_AGENCY' },
        { type: COMPLAINT_TAG, id: 'LIST_MODERATOR' },
      ],
    }),

    getAgencyQualityDashboard: build.query<AgencyQualityStats[], void>({
      query: () => '/moderation/complaint-tickets/dashboard/agency-quality',
      transformResponse: (res: ApiResponse<AgencyQualityStats[]>) => res.data,
      providesTags: [{ type: COMPLAINT_TAG, id: 'DASHBOARD_QUALITY' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useCreateComplaintImageSignatureMutation,
  useCreateComplaintTicketMutation,
  useGetMyComplaintsQuery,
  useGetComplaintDetailQuery,
  useSendComplaintMessageMutation,
  useAcceptResolutionMutation,
  useEscalateComplaintMutation,
  useSubmitComplaintFeedbackMutation,
  useGetAgencyComplaintsQuery,
  useResolveComplaintTicketMutation,
  useGetModeratorComplaintsQuery,
  useAdjudicateComplaintTicketMutation,
  useGetAgencyQualityDashboardQuery,
} = complaintsApi;
