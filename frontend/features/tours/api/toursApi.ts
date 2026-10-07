import { baseApi } from '@/store/api/baseApi';
import type { ListToursArgs, TourApiResponse, TourDetail, TourListItem } from '../types';

/** Public tour discovery, used by the cart's "add a tour" picker. */
export const toursApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getTours: build.query<TourListItem[], ListToursArgs | void>({
      query: (args) => ({ url: '/tours', params: args ?? { limit: 12 } }),
      transformResponse: (response: TourApiResponse<TourListItem[]>) => response.data,
    }),
    getTour: build.query<TourDetail, string>({
      query: (id) => ({ url: `/tours/${id}` }),
      transformResponse: (response: TourApiResponse<TourDetail>) => response.data,
    }),
  }),
});

export const { useGetToursQuery, useGetTourQuery } = toursApi;
