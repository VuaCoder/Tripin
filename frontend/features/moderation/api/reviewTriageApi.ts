import { baseApi } from '@/store/api/baseApi';
export interface ReportedReview {
  id: string; tourTitle: string; comment: string; rating: number; status: string; contentVersion: string; reportCount: number;
  reports: { id: string; category: string; description: string; createdAt: string }[];
}
export const reviewTriageApi = baseApi.injectEndpoints({ endpoints: (build) => ({
  reportedReviews: build.query<{ items: ReportedReview[]; meta: { page: number; totalPages: number } }, number>({
    query: (page) => ({ url: '/moderation/review-triage', params: { page, limit: 10 } }),
    transformResponse: (response: { data: ReportedReview[]; meta: { page: number; totalPages: number } }) => ({ items: response.data, meta: response.meta }),
  }),
  triageReview: build.mutation<unknown, { id: string; keep: boolean; reason: string; contentVersion: string; reportIds: string[] }>({
    query: ({ id, ...body }) => ({ url: `/moderation/review-triage/${id}/decision`, method: 'POST', body }),
    invalidatesTags: ['Review', 'Report', 'Moderation', 'Tour', 'Notification'],
  }),
}) });
export const { useReportedReviewsQuery, useTriageReviewMutation } = reviewTriageApi;
