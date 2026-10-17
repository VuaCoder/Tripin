import { baseApi } from '@/store/api/baseApi';
import type {
  Complaint,
  ComplaintApiResponse,
  ComplaintListResult,
  ListComplaintsArgs,
  RespondComplaintInput,
} from '../types';

/** Agency endpoints mounted at `/api/v1/agency/complaints` (use case "Handle Tour Complaints"). */
export const agencyComplaintsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAgencyComplaints: build.query<ComplaintListResult, ListComplaintsArgs | void>({
      query: (args) => ({ url: '/agency/complaints', params: { page: 1, limit: 10, ...(args ?? {}) } }),
      transformResponse: (response: ComplaintApiResponse<Complaint[]>) => ({
        items: response.data,
        meta: response.meta ?? { page: 1, limit: response.data.length || 10, total: response.data.length, totalPages: 1 },
      }),
      providesTags: [{ type: 'Complaint', id: 'AGENCY_LIST' }],
    }),

    respondToComplaint: build.mutation<Complaint, RespondComplaintInput>({
      query: ({ id, text }) => ({ url: `/agency/complaints/${id}/respond`, method: 'POST', body: { text } }),
      transformResponse: (response: ComplaintApiResponse<Complaint>) => response.data,
      invalidatesTags: [{ type: 'Complaint', id: 'AGENCY_LIST' }],
    }),
  }),
  overrideExisting: false,
});

export const { useGetAgencyComplaintsQuery, useRespondToComplaintMutation } = agencyComplaintsApi;
