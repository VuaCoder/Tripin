/** Wire shapes of `/reports` (`MyReportDto` in the backend `reports` module). */

export type ReportTarget = 'TOUR' | 'USER' | 'REVIEW';

export type ReportCategory =
  | 'MISLEADING_INFO'
  | 'SAFETY'
  | 'SERVICE_QUALITY'
  | 'PAYMENT_OR_REFUND'
  | 'INAPPROPRIATE_CONTENT'
  | 'OTHER';

export type ReportStatus = 'OPEN' | 'AGENCY_RESPONDED' | 'RESOLVED' | 'REJECTED';

/** What the reporter sees: the backend derives the agency and the tour, never the client. */
export interface MyReport {
  id: string;
  /** Lookup code, e.g. `RP-1A2B3C4D`. */
  code: string;
  targetType: ReportTarget;
  targetId: string;
  category: ReportCategory;
  description: string;
  status: ReportStatus;
  bookingId?: string;
  agencyResponse?: { text: string; respondedAt: string };
  resolution?: { decision: 'RESOLVED' | 'REJECTED'; note: string; resolvedAt: string };
  createdAt: string;
}

export interface ReportPageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ReportListResult {
  items: MyReport[];
  meta: ReportPageMeta;
}

export interface ReportApiResponse<T> {
  success: boolean;
  data: T;
  meta?: ReportPageMeta;
  error?: { code: string; message: string; details?: unknown };
}

export interface ListMyReportsArgs {
  page?: number;
  limit?: number;
  status?: ReportStatus;
}

/** Exactly what `POST /reports` accepts (the backend schema is `.strict()`). */
export interface CreateReportInput {
  targetType: ReportTarget;
  targetId: string;
  category: ReportCategory;
  description: string;
}

// ---------------------------------------------------------------- rules & limits
// Mirrored from the backend (`reports.validation.ts`) — keep both in sync.

export const REPORT_DESCRIPTION_MIN = 10;
export const REPORT_DESCRIPTION_MAX = 2000;
