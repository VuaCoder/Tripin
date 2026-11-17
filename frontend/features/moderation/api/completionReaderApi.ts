import { baseApi } from '@/store/api/baseApi';
import type { CompletionReport } from '@/features/agency/completionApi';
export interface CompletionReaderSummary {
  tourId: string; departureId: string; coverImage: string | null; destination: string | null; durationDays: number; endAt: string; bookingCount: number; participants: number;
  id: string; title: string; departureAt: string; agencyId: string; agencyName: string;
  completedAt: string; latestSubmittedAt: string; authorName: string; hasAmendment: boolean;
}
export interface CompletionReaderDetail {
  id: string; agencyId: string; title: string; departureAt: string; agencyName: string; durationDays: number;
  scheduledEndAt: string; completedAt: string; bookedParticipants: number;
  itinerary: { day: number; title: string; description?: string }[];
  reports: (Pick<CompletionReport, 'services' | 'bookedServices' | 'serviceConfirmations' | 'absenceReason' | 'additionalNotes' | 'noChanges' | 'noIncidents'> & { id: string; revision: number; createdAt: string; authorName: string; actualEndAt: string | null;
    summary: string; changes: string; incidents: string; evidence: string[]; amendmentReason: string;
    bookingCount: number; attendedCount: number; actualGuests?: { adults: number; children: number; infants: number }; bookedGuests?: { adults: number; children: number; infants: number } })[];
}
export interface CompletionReaderPage { items: CompletionReaderSummary[]; page: number; total: number; totalPages: number }
export interface CompletionReaderQuery { page: number; q?: string; agency?: string; agencyId?: string; from?: string; to?: string }
export interface CompletionAgency { id: string; name: string; avatarUrl: string | null; address: string | null; verified: boolean; reportCount: number; lastCompletedAt: string | null }
export interface CompletionAgenciesPage { items: CompletionAgency[]; page: number; total: number; totalPages: number }
export const completionReaderApi = baseApi.injectEndpoints({ endpoints: build => ({
  completionAgencies: build.query<CompletionAgenciesPage, { page: number; q?: string }>({
    query: params => ({ url: '/moderation/tour-completions/agencies', params }),
    transformResponse: (r: { data: CompletionAgenciesPage }) => r.data,
  }),
  completionAgency: build.query<CompletionAgency, string>({
    query: id => `/moderation/tour-completions/agencies/${encodeURIComponent(id)}`,
    transformResponse: (r: { data: CompletionAgency }) => r.data,
  }),
  completionReports: build.query<CompletionReaderPage, CompletionReaderQuery>({
    query: params => ({ url: '/moderation/tour-completions', params }),
    transformResponse: (r: { data: CompletionReaderPage }) => r.data,
  }),
  completionReport: build.query<CompletionReaderDetail, { id: string; byBooking?: boolean }>({
    query: ({ id, byBooking }) => `/moderation/tour-completions/${byBooking ? 'by-booking/' : ''}${encodeURIComponent(id)}`,
    transformResponse: (r: { data: CompletionReaderDetail }) => r.data,
  }),
}) });
export const { useCompletionAgencyQuery, useCompletionAgenciesQuery, useCompletionReportsQuery, useCompletionReportQuery } = completionReaderApi;
