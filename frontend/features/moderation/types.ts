/** Wire shapes of `/moderation/*` (see backend `moderation`, `tours`, `users` and `dashboards` modules). */

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
