import { baseApi } from '@/store/api/baseApi';
import type { ListToursArgs, TourApiResponse, TourCategory, TourDetail, TourListItem, TourListPage } from '../types';

/** Public tour discovery for the Tour List and the cart's "add a tour" picker. */
export const toursApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getTours: build.query<TourListPage, ListToursArgs | void>({
      query: (args) => ({ url: '/tours', params: { page: 1, limit: 12, ...(args ?? {}) } }),
      transformResponse: (response: TourApiResponse<TourListItem[]>) => ({
        items: response.data,
        meta: response.meta ?? { page: 1, limit: response.data.length || 12, total: response.data.length, totalPages: 1 },
      }),
    }),
    getTour: build.query<TourDetail, string>({
      query: (id) => ({ url: `/tours/${id}` }),
      transformResponse: (response: TourApiResponse<TourDetail>) => response.data,
    }),
    getTourCategories: build.query<TourCategory[], void>({
      query: () => ({ url: '/categories' }),
      transformResponse: (response: TourApiResponse<TourCategory[]>) => response.data,
    }),
  }),
});

export const { useGetToursQuery, useGetTourQuery, useGetTourCategoriesQuery } = toursApi;
