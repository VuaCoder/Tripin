import { baseApi } from '@/store/api/baseApi';
import type {
  AgencyPromotion,
  CreatePromotionInput,
  ListPromotionsArgs,
  PromotionApiResponse,
  PromotionListResult,
  UpdatePromotionInput,
} from '../types';

/** Agency endpoints mounted at `/api/v1/agency/promotions` (use case "Upload Promotions"). */
export const agencyPromotionsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAgencyPromotions: build.query<PromotionListResult, ListPromotionsArgs | void>({
      query: (args) => ({ url: '/agency/promotions', params: { page: 1, limit: 10, ...(args ?? {}) } }),
      transformResponse: (response: PromotionApiResponse<AgencyPromotion[]>) => ({
        items: response.data,
        meta: response.meta ?? { page: 1, limit: response.data.length || 10, total: response.data.length, totalPages: 1 },
      }),
      providesTags: [{ type: 'Promotion', id: 'AGENCY_LIST' }],
    }),

    createAgencyPromotion: build.mutation<AgencyPromotion, CreatePromotionInput>({
      query: (body) => ({ url: '/agency/promotions', method: 'POST', body }),
      transformResponse: (response: PromotionApiResponse<AgencyPromotion>) => response.data,
      invalidatesTags: [{ type: 'Promotion', id: 'AGENCY_LIST' }],
    }),

    updateAgencyPromotion: build.mutation<AgencyPromotion, UpdatePromotionInput>({
      query: ({ id, patch }) => ({ url: `/agency/promotions/${id}`, method: 'PATCH', body: patch }),
      transformResponse: (response: PromotionApiResponse<AgencyPromotion>) => response.data,
      invalidatesTags: [{ type: 'Promotion', id: 'AGENCY_LIST' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetAgencyPromotionsQuery,
  useCreateAgencyPromotionMutation,
  useUpdateAgencyPromotionMutation,
} = agencyPromotionsApi;
