import { baseApi } from '@/store/api/baseApi';

export type CommissionRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface AgencyCommissionRequest {
  id: string;
  agencyId: string;
  agencyName?: string;
  requestedByName?: string;
  currentShareBps: number;
  currentSharePercent: number;
  requestedShareBps: number;
  requestedSharePercent: number;
  baseVersion: number;
  reason: string;
  status: CommissionRequestStatus;
  decisionNote?: string | null;
  appliedVersion?: number | null;
  decidedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
}

export interface AgencyCommissionOverview {
  effectiveShareBps: number;
  effectiveSharePercent: number;
  defaultShareBps: number;
  defaultSharePercent: number;
  overrideShareBps: number | null;
  overrideSharePercent: number | null;
  commissionVersion: number;
  pendingRequest: AgencyCommissionRequest | null;
  recentRequests: AgencyCommissionRequest[];
}

interface Envelope<T> {
  data: T;
}

const tag = { type: 'AgencyCommission' as const, id: 'OVERVIEW' };

export const agencyCommissionApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAgencyCommission: build.query<AgencyCommissionOverview, void>({
      query: () => '/agency/commission',
      transformResponse: (response: Envelope<AgencyCommissionOverview>) => response.data,
      providesTags: [tag],
    }),
    createAgencyCommissionRequest: build.mutation<AgencyCommissionRequest, { requestedSharePercent: number; reason: string }>({
      query: (body) => ({ url: '/agency/commission/requests', method: 'POST', body }),
      transformResponse: (response: Envelope<AgencyCommissionRequest>) => response.data,
      invalidatesTags: (_result, error) => (error ? [] : [tag]),
    }),
    cancelAgencyCommissionRequest: build.mutation<AgencyCommissionRequest, string>({
      query: (id) => ({ url: `/agency/commission/requests/${id}/cancel`, method: 'POST' }),
      transformResponse: (response: Envelope<AgencyCommissionRequest>) => response.data,
      invalidatesTags: (_result, error) => (error ? [] : [tag]),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetAgencyCommissionQuery,
  useCreateAgencyCommissionRequestMutation,
  useCancelAgencyCommissionRequestMutation,
} = agencyCommissionApi;
