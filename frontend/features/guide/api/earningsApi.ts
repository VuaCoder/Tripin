import { baseApi } from '@/store/api/baseApi';
import type {
  ApiResult,
  Earning,
  EarningsRange,
  EarningsSummary,
  PageResponse,
  PageResult,
  Paging,
} from '../types/finance';

export const earningsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMyEarnings: build.query<PageResult<Earning>, EarningsRange & Paging>({
      query: (args) => ({
        url: '/earnings/me',
        params: { page: 1, limit: 10, ...args },
      }),
      transformResponse: (response: PageResponse<Earning>) => ({
        items: response.data,
        meta: response.meta,
      }),
      providesTags: ['Earning'],
    }),
    getMyEarningsSummary: build.query<EarningsSummary, EarningsRange>({
      query: (args) => ({ url: '/earnings/me/summary', params: args }),
      transformResponse: (response: ApiResult<EarningsSummary>) =>
        response.data,
      providesTags: ['Earning'],
    }),
  }),
});

export const { useGetMyEarningsQuery, useGetMyEarningsSummaryQuery } =
  earningsApi;
