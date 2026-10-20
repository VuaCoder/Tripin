/** Wire shapes of `/agency/complaints` (`ComplaintDto` in the backend `reports` module). */

export type ComplaintStatus = 'OPEN' | 'AGENCY_RESPONDED' | 'RESOLVED' | 'REJECTED';

export type ComplaintCategory =
  | 'MISLEADING_INFO'
  | 'SAFETY'
  | 'SERVICE_QUALITY'
  | 'PAYMENT_OR_REFUND'
  | 'INAPPROPRIATE_CONTENT'
  | 'OTHER';

export interface Complaint {
  id: string;
  targetType: 'TOUR' | 'USER' | 'REVIEW';
  targetId: string;
  category: ComplaintCategory;
  description: string;
  status: ComplaintStatus;
  bookingId?: string;
  tourId?: string;
  /** Masked by the backend (e.g. `Nguyen A.`); the reporter's identity is never exposed to agencies. */
  reporterName: string;
  agencyResponse?: { text: string; respondedAt: string };
  resolution?: { decision: 'RESOLVED' | 'REJECTED'; note: string; resolvedAt: string };
  createdAt: string;
}

export interface ComplaintPageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ComplaintListResult {
  items: Complaint[];
  meta: ComplaintPageMeta;
}

export interface ComplaintApiResponse<T> {
  success: boolean;
  data: T;
  meta?: ComplaintPageMeta;
  error?: { code: string; message: string; details?: unknown };
}

export interface ListComplaintsArgs {
  page?: number;
  limit?: number;
  status?: ComplaintStatus;
}

export interface RespondComplaintInput {
  id: string;
  text: string;
}
