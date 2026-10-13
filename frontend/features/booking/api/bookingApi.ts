import { baseApi } from '@/store/api/baseApi';
import type {
  BookingApiResponse,
  BookingDto,
  CancelBookingInput,
  CreateBookingInput,
  ListBookingsQuery,
  PaginatedBookings,
  PromotionPreview,
  PromotionPreviewInput,
} from '../types';

/** Booking endpoints mounted at `/api/v1/bookings`. */
export const bookingApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    createBooking: build.mutation<BookingDto, CreateBookingInput>({
      query: (body) => ({ url: '/bookings', method: 'POST', body }),
      transformResponse: (response: BookingApiResponse<BookingDto>) => response.data,
      invalidatesTags: [{ type: 'Booking', id: 'LIST' }],
    }),

    previewPromotion: build.query<PromotionPreview, PromotionPreviewInput>({
      query: ({ code, tourId, subtotal }) => ({
        url: '/promotions/preview',
        method: 'GET',
        params: { code, tourId, subtotal },
      }),
      transformResponse: (response: BookingApiResponse<PromotionPreview>) => response.data,
    }),

    getMyBookings: build.query<PaginatedBookings, ListBookingsQuery | void>({
      query: (params) => ({
        url: '/bookings/me',
        method: 'GET',
        params: params
          ? {
              ...(params.page ? { page: params.page } : {}),
              ...(params.limit ? { limit: params.limit } : {}),
              ...(params.status ? { status: params.status } : {}),
            }
          : undefined,
      }),
      transformResponse: (response: BookingApiResponse<BookingDto[] | { items: BookingDto[]; meta?: any }>) => {
        // Backend responds with sendPaginated(res, items, meta) -> { success: true, data: BookingDto[], meta: { ... } }
        if (Array.isArray(response.data)) {
          return {
            items: response.data,
            meta: response.meta ?? {
              page: 1,
              limit: response.data.length || 10,
              total: response.data.length,
              totalPages: 1,
            },
          };
        }
        // Fallback if data is already wrapped as { items, meta }
        if (
          response.data &&
          typeof response.data === 'object' &&
          'items' in response.data &&
          Array.isArray((response.data as { items: BookingDto[] }).items)
        ) {
          const wrapped = response.data as { items: BookingDto[]; meta?: any };
          return {
            items: wrapped.items,
            meta: wrapped.meta ?? response.meta ?? {
              page: 1,
              limit: 10,
              total: wrapped.items.length,
              totalPages: 1,
            },
          };
        }
        return {
          items: [],
          meta: { page: 1, limit: 10, total: 0, totalPages: 1 },
        };
      },
      providesTags: (result) =>
        result?.items && Array.isArray(result.items)
          ? [
              ...result.items.map((item) => ({ type: 'Booking' as const, id: item.id })),
              { type: 'Booking' as const, id: 'LIST' },
            ]
          : [{ type: 'Booking' as const, id: 'LIST' }],
    }),

    getBookingById: build.query<BookingDto, string>({
      query: (id) => ({
        url: `/bookings/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: BookingApiResponse<BookingDto>) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'Booking', id }],
    }),

    cancelBooking: build.mutation<BookingDto, CancelBookingInput>({
      query: ({ id, reason }) => ({
        url: `/bookings/${id}/cancel`,
        method: 'POST',
        body: reason ? { reason } : {},
      }),
      transformResponse: (response: BookingApiResponse<BookingDto>) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Booking', id },
        { type: 'Booking', id: 'LIST' },
      ],
    }),

    completeBooking: build.mutation<BookingDto, string>({
      query: (id) => ({
        url: `/bookings/${id}/complete`,
        method: 'POST',
      }),
      transformResponse: (response: BookingApiResponse<BookingDto>) => response.data,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Booking', id },
        { type: 'Booking', id: 'LIST' },
        { type: 'Review', id: 'ME' },
      ],
    }),
  }),
});

export const {
  useCreateBookingMutation,
  useLazyPreviewPromotionQuery,
  useGetMyBookingsQuery,
  useGetBookingByIdQuery,
  useCancelBookingMutation,
  useCompleteBookingMutation,
} = bookingApi;
