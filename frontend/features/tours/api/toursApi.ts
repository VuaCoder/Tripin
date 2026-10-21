import { baseApi } from '@/store/api/baseApi';
import type { AgencyDashboard, AgencyGuide } from '@/features/agency/types';
import type { AgencyTourListResult, ExtractedTourCandidate, ListToursArgs, TourApiError, TourApiResponse, TourCategory, TourContentInput, TourDestination, TourDetail, TourListItem, TourListResult, TourStatus } from '../types';

/** Public tour discovery for tour listings. */
export const toursApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getTours: build.query<TourListResult, ListToursArgs | void>({
      query: (args) => ({ url: '/tours', params: { page: 1, limit: 12, ...(args ?? {}) } }),
      transformResponse: (response: TourApiResponse<TourListItem[]>) => ({
        items: response.data,
        meta: response.meta ?? { page: 1, limit: response.data.length || 12, total: response.data.length, totalPages: 1 },
      }),
    }),
    getTourDestinations: build.query<TourDestination[], void>({
      query: () => ({ url: '/tours/destinations' }),
      transformResponse: (response: TourApiResponse<TourDestination[]>) => response.data,
    }),
    getTour: build.query<TourDetail, string>({
      query: (id) => ({ url: `/tours/${id}` }),
      transformResponse: (response: TourApiResponse<TourDetail>) => response.data,
    }),
    getTourCategories: build.query<TourCategory[], void>({
      query: () => ({ url: '/categories' }),
      transformResponse: (response: TourApiResponse<TourCategory[]>) => response.data,
      providesTags: [{ type: 'Category', id: 'LIST' }],
    }),
    getAgencyTours: build.query<AgencyTourListResult, { page?: number; limit?: number; status?: TourStatus; q?: string } | void>({
      query: (args) => ({ url: '/agency/tours', params: { page: 1, limit: 12, ...(args ?? {}) } }),
      transformResponse: (response: TourApiResponse<TourDetail[]>) => ({
        items: response.data,
        meta: response.meta ?? { page: 1, limit: response.data.length || 12, total: response.data.length, totalPages: 1 },
      }),
      providesTags: (result) => [{ type: 'Tour', id: 'AGENCY_LIST' }, ...(result?.items ?? []).map(({ id }) => ({ type: 'Tour' as const, id }))],
    }),
    getAgencyTour: build.query<TourDetail, string>({
      query: (id) => ({ url: `/agency/tours/${id}` }),
      transformResponse: (response: TourApiResponse<TourDetail>) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'Tour', id }],
    }),
    createAgencyTour: build.mutation<TourDetail, TourContentInput>({
      query: (body) => ({ url: '/agency/tours', method: 'POST', body }),
      transformResponse: (response: TourApiResponse<TourDetail>) => response.data,
      invalidatesTags: [{ type: 'Tour', id: 'AGENCY_LIST' }],
    }),
    updateAgencyTour: build.mutation<TourDetail, { id: string; body: Partial<TourContentInput> }>({
      query: ({ id, body }) => ({ url: `/agency/tours/${id}`, method: 'PATCH', body }),
      transformResponse: (response: TourApiResponse<TourDetail>) => response.data,
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Tour', id }, { type: 'Tour', id: 'AGENCY_LIST' }],
    }),
    deleteAgencyTour: build.mutation<void, string>({
      query: (id) => ({ url: `/agency/tours/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Tour', id: 'AGENCY_LIST' }],
    }),
    setAgencyTourItinerary: build.mutation<TourDetail, { id: string; days: TourDetail['itinerary'] }>({
      query: ({ id, days }) => ({ url: `/agency/tours/${id}/itinerary`, method: 'PUT', body: { days } }),
      transformResponse: (response: TourApiResponse<TourDetail>) => response.data,
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Tour', id }, { type: 'Tour', id: 'AGENCY_LIST' }],
    }),
    setAgencyTourAvailability: build.mutation<TourDetail, { id: string; departures: { id?: string; date: string; capacity: number; priceOverride?: number; isOpen: boolean }[] }>({
      query: ({ id, departures }) => ({ url: `/agency/tours/${id}/availability`, method: 'PUT', body: { departures } }),
      transformResponse: (response: TourApiResponse<TourDetail>) => response.data,
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Tour', id }, { type: 'Tour', id: 'AGENCY_LIST' }],
    }),
    submitAgencyTour: build.mutation<TourDetail, string>({
      query: (id) => ({ url: `/agency/tours/${id}/submit`, method: 'POST' }),
      transformResponse: (response: TourApiResponse<TourDetail>) => response.data,
      invalidatesTags: (_result, _error, id) => [{ type: 'Tour', id }, { type: 'Tour', id: 'AGENCY_LIST' }],
    }),
    importAgencyTours: build.mutation<{ created: number; tours: TourDetail[] }, TourContentInput[]>({
      query: (tours) => ({ url: '/agency/tours/import', method: 'POST', body: { tours } }),
      transformResponse: (response: TourApiResponse<{ created: number; tours: TourDetail[] }>) => response.data,
      invalidatesTags: [{ type: 'Tour', id: 'AGENCY_LIST' }],
    }),
    extractAgencyTourDocument: build.mutation<{ tours: ExtractedTourCandidate[] }, File>({
      query: (file) => {
        const body = new FormData();
        body.append('file', file);
        return { url: '/agency/tours/extract-document', method: 'POST', body };
      },
      transformResponse: (response: TourApiResponse<{ tours: ExtractedTourCandidate[] }>) => response.data,
    }),
    getAgencyDashboard: build.query<AgencyDashboard, void>({
      query: () => ({ url: '/agency/dashboard' }),
      transformResponse: (response: TourApiResponse<AgencyDashboard>) => response.data,
    }),
    getAgencyGuides: build.query<{ items: AgencyGuide[]; meta: import('../types').TourListMeta }, { q?: string; page: number }>({
      query: (args) => ({ url: '/agency/guides', params: { ...args, limit: 20 } }),
      transformResponse: (response: TourApiResponse<AgencyGuide[]>) => ({ items: response.data, meta: response.meta! }),
    }),
    assignAgencyTourGuide: build.mutation<TourDetail, { id: string; guideId: string | null; feePerBooking?: number }>({
      query: ({ id, ...body }) => ({ url: `/agency/tours/${id}/guide`, method: 'PUT', body }),
      transformResponse: (response: TourApiResponse<TourDetail>) => response.data,
      invalidatesTags: (result, _error, { id }) => result ? [{ type: 'Tour', id }, { type: 'Tour', id: 'AGENCY_LIST' }, { type: 'Tour', id: 'GUIDE_ASSIGNED' }] : [],
    }),
    uploadAgencyTourImage: build.mutation<{ url: string; publicId: string }, File>({
      query: (file) => {
        const body = new FormData();
        body.append('file', file);
        return { url: '/agency/tours/upload-image', method: 'POST', body };
      },
      transformResponse: (response: TourApiResponse<{ url: string; publicId: string }>) => response.data,
    }),
    createAgencyCategory: build.mutation<TourCategory, { name: string }>({
      query: (body) => ({ url: '/agency/tours/categories', method: 'POST', body }),
      transformResponse: (response: TourApiResponse<TourCategory>) => response.data,
      invalidatesTags: [{ type: 'Category', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetToursQuery, useGetTourDestinationsQuery, useGetTourQuery, useGetTourCategoriesQuery,
  useGetAgencyToursQuery, useGetAgencyTourQuery, useCreateAgencyTourMutation, useUpdateAgencyTourMutation,
  useDeleteAgencyTourMutation, useSetAgencyTourItineraryMutation, useSetAgencyTourAvailabilityMutation,
  useSubmitAgencyTourMutation, useImportAgencyToursMutation, useExtractAgencyTourDocumentMutation,
  useGetAgencyDashboardQuery,
  useGetAgencyGuidesQuery, useAssignAgencyTourGuideMutation,
  useUploadAgencyTourImageMutation,
  useCreateAgencyCategoryMutation,
} = toursApi;

const TOUR_ERROR_TRANSLATIONS: Record<string, string> = {
  NO_OPEN_DEPARTURE: 'Vui lòng chuyển sang tab "Khởi hành" và thêm ít nhất một ngày khởi hành trong tương lai đang mở bán trước khi gửi duyệt tour.',
  'Add at least one open future departure before submitting': 'Vui lòng chuyển sang tab "Khởi hành" và thêm ít nhất một ngày khởi hành trong tương lai đang mở bán trước khi gửi duyệt tour.',
  'Add at least one category before submitting': 'Vui lòng chọn ít nhất một danh mục cho tour trước khi gửi duyệt.',
  'The tour was modified, please retry': 'Tour đã được cập nhật bởi một phiên khác, vui lòng làm mới trang.',
  'Itinerary days or ranges cannot overlap or duplicate': 'Các ngày hoặc khoảng ngày trong lịch trình không được trùng lặp.',
  'Duplicate departure date': 'Ngày khởi hành này đã tồn tại trong danh sách.',
};

export function getTourApiMessage(error: unknown, fallback = 'Đã có lỗi xảy ra. Vui lòng thử lại.'): string {
  const result = error as { error?: { data?: TourApiError }; data?: TourApiError } | undefined;
  const errObj = result?.error?.data?.error || result?.data?.error;
  if (errObj?.code && TOUR_ERROR_TRANSLATIONS[errObj.code]) {
    return TOUR_ERROR_TRANSLATIONS[errObj.code];
  }
  const rawMsg = errObj?.message;
  if (rawMsg && TOUR_ERROR_TRANSLATIONS[rawMsg]) {
    return TOUR_ERROR_TRANSLATIONS[rawMsg];
  }
  return rawMsg || fallback;
}
