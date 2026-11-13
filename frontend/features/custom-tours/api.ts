import { baseApi } from '@/store/api/baseApi';
import type { BookingDto } from '@/features/booking/types';
import type {
  CreateCustomTourInput,
  CustomTourCheckoutInput,
  CustomTourDecision,
  CustomTourDraftInput,
  CustomTourListResult,
  CustomTourOfferAction,
  CustomTourRequestDto,
  ListCustomToursArgs,
} from './types';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface PaginatedApiResponse<T> {
  success: boolean;
  data?: T[];
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const normalizeListResponse = (res: PaginatedApiResponse<CustomTourRequestDto>): CustomTourListResult => {
  const items = res.data ?? [];
  return {
    items,
    meta: res.meta ?? { page: 1, limit: items.length || 10, total: items.length, totalPages: 1 },
  };
};

const CUSTOM_TOUR_TAG = 'CustomTour' as const;

export const customToursApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    createCustomTour: build.mutation<CustomTourRequestDto, CreateCustomTourInput>({
      query: (body) => ({ url: '/custom-tours', method: 'POST', body }),
      transformResponse: (res: ApiResponse<CustomTourRequestDto>) => res.data,
      invalidatesTags: [CUSTOM_TOUR_TAG],
    }),

    listCustomTours: build.query<CustomTourListResult, ListCustomToursArgs | void>({
      query: (args) => ({
        url: '/custom-tours',
        params: { page: 1, limit: 10, ...(args ?? {}) },
      }),
      transformResponse: (res: PaginatedApiResponse<CustomTourRequestDto>) => normalizeListResponse(res),
      providesTags: [CUSTOM_TOUR_TAG],
    }),

    getCustomTour: build.query<CustomTourRequestDto, string>({
      query: (id) => `/custom-tours/${id}`,
      transformResponse: (res: ApiResponse<CustomTourRequestDto>) => res.data,
      providesTags: (_result, _error, id) => [{ type: CUSTOM_TOUR_TAG, id }],
    }),

    decideCustomTour: build.mutation<CustomTourRequestDto, { id: string; decision: CustomTourDecision }>({
      query: ({ id, decision }) => ({
        url: `/custom-tours/${id}/decision`,
        method: 'PATCH',
        body: { decision },
      }),
      transformResponse: (res: ApiResponse<CustomTourRequestDto>) => res.data,
      invalidatesTags: (_result, _error, { id }) => [CUSTOM_TOUR_TAG, { type: CUSTOM_TOUR_TAG, id }],
    }),

    /** Agency saves the negotiated terms of the private tour; the revision guards against two tabs. */
    saveCustomTourDraft: build.mutation<CustomTourRequestDto, CustomTourDraftInput>({
      query: ({ id, ...body }) => ({ url: `/custom-tours/${id}/draft`, method: 'PATCH', body }),
      transformResponse: (res: ApiResponse<CustomTourRequestDto>) => res.data,
      invalidatesTags: (_result, _error, { id }) => [CUSTOM_TOUR_TAG, { type: CUSTOM_TOUR_TAG, id }],
    }),

    sendCustomTourOffer: build.mutation<CustomTourRequestDto, { id: string; revision: number }>({
      query: ({ id, revision }) => ({ url: `/custom-tours/${id}/offers`, method: 'POST', body: { revision } }),
      transformResponse: (res: ApiResponse<CustomTourRequestDto>) => res.data,
      invalidatesTags: (_result, _error, { id }) => [CUSTOM_TOUR_TAG, { type: CUSTOM_TOUR_TAG, id }],
    }),

    acceptCustomTourOffer: build.mutation<CustomTourRequestDto, CustomTourOfferAction>({
      query: ({ id, revision }) => ({ url: `/custom-tours/${id}/acceptance`, method: 'POST', body: { revision } }),
      transformResponse: (res: ApiResponse<CustomTourRequestDto>) => res.data,
      invalidatesTags: (_result, _error, { id }) => [CUSTOM_TOUR_TAG, { type: CUSTOM_TOUR_TAG, id }],
    }),

    /** Traveler saves the passenger form; the checkout revision guards against a second device overwriting it. */
    saveCustomTourCheckoutDraft: build.mutation<CustomTourRequestDto, { id: string } & CustomTourCheckoutInput>({
      query: ({ id, ...body }) => ({ url: `/custom-tours/${id}/checkout-draft`, method: 'PATCH', body }),
      transformResponse: (res: ApiResponse<CustomTourRequestDto>) => res.data,
      invalidatesTags: (_result, _error, { id }) => [{ type: CUSTOM_TOUR_TAG, id }],
    }),

    /** Turns the accepted offer and the saved form into the request's one live booking (201) or returns it (200). */
    createCustomTourBooking: build.mutation<BookingDto, { id: string }>({
      query: ({ id }) => ({ url: `/custom-tours/${id}/bookings`, method: 'POST', body: {} }),
      transformResponse: (res: ApiResponse<BookingDto>) => res.data,
      invalidatesTags: (_result, _error, { id }) => [CUSTOM_TOUR_TAG, { type: CUSTOM_TOUR_TAG, id }, { type: 'Booking', id: 'LIST' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useCreateCustomTourMutation,
  useListCustomToursQuery,
  useGetCustomTourQuery,
  useDecideCustomTourMutation,
  useSaveCustomTourDraftMutation,
  useSendCustomTourOfferMutation,
  useAcceptCustomTourOfferMutation,
  useSaveCustomTourCheckoutDraftMutation,
  useCreateCustomTourBookingMutation,
} = customToursApi;
