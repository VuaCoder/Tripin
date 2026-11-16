import { baseApi } from '@/store/api/baseApi';
import type { GuestCounts } from '@travel-platform/constants';
export type ServiceStatus = 'UNCONFIRMED' | 'PROVIDED' | 'NOT_PROVIDED' | 'NOT_APPLICABLE';
export type ExtraServiceStatus = 'UNCONFIRMED' | 'PROVIDED' | 'NOT_PROVIDED' | 'PARTIALLY_PROVIDED';
export interface CompletionBookedService { key: string; serviceId: string; name: string; unit: string; quantity: number; bookingCount: number }
export interface CompletionReport {
  bookedServices?: CompletionBookedService[];
  serviceConfirmations?: { key: string; status: ExtraServiceStatus }[];
  noChanges?: boolean; noIncidents?: boolean;
  services?: { transport: ServiceStatus; guide: ServiceStatus; entranceTickets: ServiceStatus };
  absenceReason?: string; additionalNotes?: string;
  actualGuests?: GuestCounts;
  bookedGuests?: GuestCounts;
  actualParticipants?: number;
  bookedParticipants?: number;
  expectedRevision: number; actualEndAt: string | null; summary: string; changes: string; incidents: string;
  attendance: { bookingId: string; attendedCount: number | null }[]; evidence: string[]; amendmentReason: string;
}
export interface DepartureCompletion {
  bookedServices?: CompletionBookedService[];
  bookedGuests?: GuestCounts;
  id: string; revision: number; scheduledEndAt: string; completedAt: string | null;
  snapshot: { title: string; departureAt: string };
  bookings: { id: string; bookingCode: string; participants: number; attendedParticipants: number | null; status: string }[];
  reports: { id: string; revision: number; actorId: string; submitted: boolean; createdAt: string; payload: CompletionReport }[];
}
type Scope = { tourId: string; departureId: string };
export interface CompletionQueue {
  items: { departureId: string; tourId: string; title: string; coverImage?: string | null; destination?: string; durationDays?: number; departureAt: string; endAt: string; bookingCount: number; participants: number; completedAt?: string | null; hasReport?: boolean }[];
  hasNext: boolean; page: number;
}
const url = (s: Scope) => `/agency/tours/${s.tourId}/departures/${s.departureId}/completion`;
export const completionApi = baseApi.injectEndpoints({ endpoints: build => ({
  pendingCompletions: build.query<CompletionQueue, { page: number; status: 'pending' | 'completed' }>({
    query: params => ({ url: '/agency/completions', params }),
    transformResponse: (r: { data: CompletionQueue }) => r.data,
    providesTags: ['Booking'],
  }),
  departureCompletion: build.query<DepartureCompletion, Scope>({
    query: url, transformResponse: (r: { data: DepartureCompletion }) => r.data,
    providesTags: (_r, _e, s) => [{ type: 'Tour', id: `completion:${s.departureId}` }],
  }),
  uploadCompletionImage: build.mutation<{ url: string; publicId: string }, File>({
    query: file => { const body = new FormData(); body.append('file', file); return { url: '/agency/tours/upload-image', method: 'POST', body }; },
    transformResponse: (r: { data: { url: string; publicId: string } }) => r.data,
  }),
  saveCompletion: build.mutation<DepartureCompletion, Scope & { report: CompletionReport; submit: boolean }>({
    query: ({ report, submit, ...scope }) => ({ url: `${url(scope)}/${submit ? 'submit' : 'draft'}`, method: 'POST', body: report }),
    transformResponse: (r: { data: DepartureCompletion }) => r.data,
    invalidatesTags: (result, _e, s) => result ? [{ type: 'Tour', id: `completion:${s.departureId}` }, { type: 'Tour', id: s.tourId }, 'Booking', 'Notification'] : [],
  }),
}) });
export const { useDepartureCompletionQuery, useSaveCompletionMutation, useUploadCompletionImageMutation, usePendingCompletionsQuery } = completionApi;
