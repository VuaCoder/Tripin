import { baseApi } from '@/store/api/baseApi';
import type { CreateReportInput, ListMyReportsArgs, MyReport, ReportApiResponse, ReportListResult } from '../types';

const ME_TAG = { type: 'Report', id: 'ME' } as const;

/** Traveler endpoints mounted at `/api/v1/reports` (use case "Send report"). */
export const reportApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** `POST /reports`. The backend verifies the target and derives the agency / tour itself. */
    createReport: build.mutation<MyReport, CreateReportInput>({
      query: (body) => ({ url: '/reports', method: 'POST', body }),
      transformResponse: (response: ReportApiResponse<MyReport>) => response.data,
      invalidatesTags: [ME_TAG],
    }),

    getMyReports: build.query<ReportListResult, ListMyReportsArgs | void>({
      query: (args) => ({ url: '/reports/me', params: { page: 1, limit: 10, ...(args ?? {}) } }),
      transformResponse: (response: ReportApiResponse<MyReport[]>) => ({
        items: response.data,
        meta: response.meta ?? { page: 1, limit: response.data.length || 10, total: response.data.length, totalPages: 1 },
      }),
      providesTags: [ME_TAG],
    }),
  }),
  overrideExisting: false,
});

export const { useCreateReportMutation, useGetMyReportsQuery } = reportApi;
