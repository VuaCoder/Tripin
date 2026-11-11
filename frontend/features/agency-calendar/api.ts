import { baseApi } from '@/store/api/baseApi';
import type { DepartureEvent, NewDeparture, DeparturePatch } from './types';

const tags = (id: string) => [
  { type: 'Tour' as const, id }, { type: 'Tour' as const, id: 'AGENCY_LIST' },
  { type: 'Tour' as const, id: 'AGENCY_CALENDAR' }, { type: 'Tour' as const, id: 'AGENCY_DASHBOARD' },
];
export const calendarApi = baseApi.injectEndpoints({ endpoints: (build) => ({
  agencyCalendar: build.query<DepartureEvent[], { from: string; to: string; tourId?: string }>({
    query: (params) => ({ url: '/agency/calendar', params }),
    transformResponse: (response: { data: DepartureEvent[] }) => response.data,
    providesTags: (data) => [{ type: 'Tour', id: 'AGENCY_CALENDAR' }, ...(data ?? []).map((event) => ({ type: 'Tour' as const, id: event.tourId }))],
  }),
  createDepartures: build.mutation<{ events: DepartureEvent[]; created: number; skipped: number; replayed: number }, { tourId: string; departures: NewDeparture[] }>({
    query: ({ tourId, departures }) => ({ url: `/agency/tours/${tourId}/departures`, method: 'POST', body: { departures } }),
    transformResponse: (response: { data: { events: DepartureEvent[]; created: number; skipped: number; replayed: number } }) => response.data,
    invalidatesTags: (_data, _error, input) => tags(input.tourId),
  }),
  updateDeparture: build.mutation<DepartureEvent, { tourId: string; id: string; body: DeparturePatch }>({
    query: ({ tourId, id, body }) => ({ url: `/agency/tours/${tourId}/departures/${id}`, method: 'PATCH', body }),
    transformResponse: (response: { data: DepartureEvent }) => response.data,
    invalidatesTags: (_data, _error, input) => tags(input.tourId),
  }),
  deleteDeparture: build.mutation<void, { tourId: string; id: string; expectedDate: string }>({
    query: ({ tourId, id, expectedDate }) => ({ url: `/agency/tours/${tourId}/departures/${id}`, method: 'DELETE', body: { expectedDate } }),
    invalidatesTags: (_data, _error, input) => tags(input.tourId),
  }),
}) });
export const { useAgencyCalendarQuery, useCreateDeparturesMutation, useUpdateDepartureMutation, useDeleteDepartureMutation } = calendarApi;
