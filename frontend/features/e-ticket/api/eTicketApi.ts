import { baseApi } from '@/store/api/baseApi';
import type {
  ETicketApiResponse,
  ETicketDto,
  ListETicketsQuery,
  PaginatedETickets,
} from '../types';

/** E-Ticket endpoints mounted at `/api/v1/e-tickets`. */
export const eTicketApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMyETickets: build.query<PaginatedETickets, ListETicketsQuery | void>({
      query: (params) => ({
        url: '/e-tickets',
        method: 'GET',
        params: params
          ? {
              ...(params.page ? { page: params.page } : {}),
              ...(params.limit ? { limit: params.limit } : {}),
            }
          : undefined,
      }),
      transformResponse: (response: ETicketApiResponse<ETicketDto[] | { items: ETicketDto[]; meta?: any }>) => {
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
        if (
          response.data &&
          typeof response.data === 'object' &&
          'items' in response.data &&
          Array.isArray((response.data as { items: ETicketDto[] }).items)
        ) {
          const wrapped = response.data as { items: ETicketDto[]; meta?: any };
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
              ...result.items.map((item) => ({ type: 'ETicket' as const, id: item.id })),
              { type: 'ETicket' as const, id: 'LIST' },
            ]
          : [{ type: 'ETicket' as const, id: 'LIST' }],
    }),

    getETicketById: build.query<ETicketDto, string>({
      query: (id) => ({
        url: `/e-tickets/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: ETicketApiResponse<ETicketDto>) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'ETicket', id }],
    }),

    getETicketByBookingId: build.query<ETicketDto, string>({
      query: (bookingId) => ({
        url: `/e-tickets/booking/${bookingId}`,
        method: 'GET',
      }),
      transformResponse: (response: ETicketApiResponse<ETicketDto>) => response.data,
      providesTags: (_result, _error, bookingId) => [{ type: 'ETicket', id: `booking-${bookingId}` }],
    }),
  }),
});

export const {
  useGetMyETicketsQuery,
  useGetETicketByIdQuery,
  useGetETicketByBookingIdQuery,
} = eTicketApi;
