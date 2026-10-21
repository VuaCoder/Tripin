import { baseApi } from '@/store/api/baseApi';
import type { AgencyBooking, AgencyBookingFilters } from '@/features/agency/types';
import type {
  AvailablePromotions,
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
    getAgencyBookings: build.query<{ items: AgencyBooking[]; meta: import('../types').BookingPaginationMeta }, AgencyBookingFilters>({
      query: (params) => ({ url: '/agency/bookings', params }),
      transformResponse: (response: BookingApiResponse<AgencyBooking[]>) => ({ items: response.data, meta: response.meta! }),
      providesTags: (result) => [{ type: 'Booking', id: 'AGENCY_LIST' }, ...(result?.items ?? []).map(({ id }) => ({ type: 'Booking' as const, id }))],
    }),
    getAgencyBooking: build.query<AgencyBooking, string>({
      query: (id) => ({ url: `/agency/bookings/${id}` }),
      transformResponse: (response: BookingApiResponse<AgencyBooking>) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'Booking', id }],
    }),
    downloadAgencyCustomers: build.mutation<{ downloaded: true }, { tourId: string; departureId?: string }>({
      async queryFn({ tourId, departureId }, _api, _options, baseQuery) {
        const result = await baseQuery({
          url: `/agency/tours/${tourId}/customers.pdf`, params: departureId ? { departureId } : undefined,
          cache: 'no-store',
          responseHandler: async (response) => {
            if (!response.ok) return response.json().catch(() => ({ error: { message: 'Không thể xuất danh sách khách.' } }));
            const blob = await response.blob();
            if (!blob.type.toLowerCase().includes('application/pdf') || await blob.slice(0, 5).text() !== '%PDF-') throw new Error('Invalid PDF response');
            return blob;
          },
        });
        if (result.error) return { error: result.error };
        let url: string | undefined;
        try {
          url = URL.createObjectURL(result.data as Blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `customers-${tourId}.pdf`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          const downloadUrl = url;
          window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
          return { data: { downloaded: true } };
        } catch {
          if (url) URL.revokeObjectURL(url);
          return { error: { status: 'CUSTOM_ERROR', error: 'Không thể tải file PDF. Vui lòng thử lại.' } };
        }
      },
    }),
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

    getAvailablePromotions: build.query<AvailablePromotions, { tourId: string }>({
      query: ({ tourId }) => ({
        url: '/promotions/available',
        method: 'GET',
        params: { tourId },
      }),
      transformResponse: (response: BookingApiResponse<AvailablePromotions>) => response.data,
    }),

    getMyVouchers: build.query<import('../types').UserVoucherItem[], void>({
      query: () => ({ url: '/promotions/my-vouchers' }),
      transformResponse: (response: BookingApiResponse<import('../types').UserVoucherItem[]>) => response.data,
      providesTags: [{ type: 'Promotion', id: 'MY_VOUCHERS' }],
    }),

    collectVoucher: build.mutation<import('../types').UserVoucherItem, { promotionId: string }>({
      query: (body) => ({ url: '/promotions/collect', method: 'POST', body }),
      transformResponse: (response: BookingApiResponse<import('../types').UserVoucherItem>) => response.data,
      invalidatesTags: [{ type: 'Promotion', id: 'MY_VOUCHERS' }],
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
  useGetAgencyBookingsQuery, useGetAgencyBookingQuery, useDownloadAgencyCustomersMutation,
  useCreateBookingMutation,
  useLazyPreviewPromotionQuery,
  useGetAvailablePromotionsQuery,
  useGetMyVouchersQuery,
  useCollectVoucherMutation,
  useGetMyBookingsQuery,
  useGetBookingByIdQuery,
  useCancelBookingMutation,
  useCompleteBookingMutation,
} = bookingApi;
