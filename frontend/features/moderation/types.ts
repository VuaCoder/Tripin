/** Wire shapes of `/moderation/*` (see backend `moderation`, `tours`, `users`, `reports`, `reviews`, `support` and `dashboards` modules). */

import type { MyReport, ReportCategory, ReportStatus, ReportTarget } from '@/features/report/types';

export type ModerationTourStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'ARCHIVED';
export type AgencyVerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface ModerationPageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ModerationApiResponse<T> {
  success: boolean;
  data: T;
  meta?: ModerationPageMeta;
  error?: { code: string; message: string; details?: unknown };
}

export interface ModerationListResult<T> {
  items: T[];
  meta: ModerationPageMeta;
}

export interface ModerationDashboard {
  generatedAt: string;
  queues: {
    toursPendingReview: number;
    agenciesPendingVerification: number;
    reportsOpen: number;
    reportsAwaitingDecision: number;
    supportTicketsOpen: number;
    supportTicketsInProgress: number;
  };
  tours: Record<string, number>;
  reviews: { visible: number; hidden: number };
}

export interface ModerationTour {
  id: string;
  title: string;
  summary?: string;
  description?: string;
  destination: string;
  durationDays: number;
  basePrice: number;
  coverImage?: string;
  status: ModerationTourStatus;
  statusReason?: string;
  submittedAt?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
  agency?: { id: string; name: string; avatarUrl?: string };
  inclusions?: string[];
  exclusions?: string[];
  itinerary?: { day: number; title: string; description?: string; activities: string[] }[];
}

export interface ModerationAgency {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  status: string;
  createdAt: string;
  agencyProfile?: {
    companyName?: string;
    description?: string;
    address?: string;
    website?: string;
    licenseNumber?: string;
    taxId?: string;
    businessLicenseUrl?: string;
    verificationStatus: AgencyVerificationStatus;
    verificationNote?: string;
  };
}

export interface ListModerationToursArgs {
  page?: number;
  limit?: number;
  status?: ModerationTourStatus;
  q?: string;
}

export interface ListModerationAgenciesArgs {
  page?: number;
  limit?: number;
  status?: AgencyVerificationStatus;
}

export interface ValidateTourInput {
  id: string;
  approve: boolean;
  reason?: string;
}

export interface SuspendTourInput {
  id: string;
  reason: string;
}

export interface VerifyAgencyInput {
  id: string;
  approve: boolean;
  note?: string;
}

// ------------------------------------------------------- Disputes (reports)

/** Moderator view of a report (`ModerationReportDto`): knows the reporter, the agency and the tour by name. */
export interface ModerationReport extends MyReport {
  reporterId: string;
  reporterName?: string;
  agencyId?: string;
  agencyName?: string;
  tourId?: string;
  tourTitle?: string;
  /** The reported thing itself: a tour title, an account name, or — for a review — the tour it is about. */
  targetName?: string;
  /** The booking offered as evidence, as its code (e.g. `TRP-AAAA2222`), never a uuid. */
  bookingCode?: string;
  /** Present only for a report about a review: the review itself, so the moderator need not go hunting for it. */
  review?: {
    rating: number;
    comment: string;
    status: ReviewStatus;
    hiddenReason?: string;
    authorName?: string;
  };
}

export interface ListModerationReportsArgs {
  page?: number;
  limit?: number;
  status?: ReportStatus;
  targetType?: ReportTarget;
  category?: ReportCategory;
}

export interface ResolveReportInput {
  id: string;
  decision: 'RESOLVED' | 'REJECTED';
  note: string;
}

// ----------------------------------------------------------------- Reviews

export type ReviewStatus = 'VISIBLE' | 'HIDDEN';

/** Moderator view of a review (`ModerationReviewDto`): knows the author and the agency by name. */
export interface ModerationReview {
  id: string;
  bookingId: string;
  tourId: string;
  tourTitle: string;
  rating: number;
  comment: string;
  status: ReviewStatus;
  hiddenReason?: string;
  travelerId: string;
  travelerName?: string;
  agencyId: string;
  agencyName?: string;
  moderatedAt?: string;
  moderatedBy?: string;
  createdAt: string;
}

export interface ListModerationReviewsArgs {
  page?: number;
  limit?: number;
  status?: ReviewStatus;
  tourId?: string;
}

export interface ModerateReviewInput {
  id: string;
  hide: boolean;
  reason?: string;
}

// ------------------------------------------------- Complaints (support tickets)

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketCategory = 'BOOKING' | 'PAYMENT' | 'ACCOUNT' | 'TOUR' | 'OTHER';

/** Staff see who wrote what: `USER` is the traveler, `SUPPORT` is a moderator. */
export interface TicketMessage {
  author: 'USER' | 'SUPPORT';
  text: string;
  createdAt: string;
}

export interface ModerationTicketSummary {
  id: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  bookingId?: string;
  messageCount: number;
  lastMessageAt: string;
  createdAt: string;
}

/** The detail adds the conversation, who opened it and who handles it, by name. */
export interface ModerationTicket extends ModerationTicketSummary {
  messages: TicketMessage[];
  userId: string;
  userName?: string;
  assignedTo?: string;
  assignedToName?: string;
  /** The related booking as its code (e.g. `TRP-AAAA2222`), never a uuid. */
  bookingCode?: string;
}

export interface ListModerationTicketsArgs {
  page?: number;
  limit?: number;
  status?: TicketStatus;
  category?: TicketCategory;
}

export interface TicketReplyInput {
  id: string;
  text: string;
  resolve?: boolean;
}

export interface TicketStatusInput {
  id: string;
  status: 'IN_PROGRESS' | 'RESOLVED';
}

// ---------------------------------------------------------------- Accounts

export interface BanAccountInput {
  id: string;
  reason: string;
}
