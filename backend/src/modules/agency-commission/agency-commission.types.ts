export const COMMISSION_REQUEST_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;
export type CommissionRequestStatus = (typeof COMMISSION_REQUEST_STATUS)[keyof typeof COMMISSION_REQUEST_STATUS];

/** The agency's share of a booking total, in basis points (0..5000 = 0..50%). */
export const MAX_AGENCY_SHARE_BPS = 5000;

export interface AgencyCommissionRequestDto {
  id: string;
  agencyId: string;
  agencyName?: string;
  requestedByName?: string;
  currentShareBps: number;
  currentSharePercent: number;
  requestedShareBps: number;
  requestedSharePercent: number;
  baseVersion: number;
  reason: string;
  status: CommissionRequestStatus;
  decisionNote?: string | null;
  appliedVersion?: number | null;
  decidedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
}

export interface AgencyCommissionOverviewDto {
  /** What the agency keeps on a booking created now, after the platform fee. */
  effectiveShareBps: number;
  effectiveSharePercent: number;
  defaultShareBps: number;
  defaultSharePercent: number;
  overrideShareBps: number | null;
  overrideSharePercent: number | null;
  commissionVersion: number;
  pendingRequest: AgencyCommissionRequestDto | null;
  recentRequests: AgencyCommissionRequestDto[];
}

export interface ListCommissionRequestsQuery {
  status?: CommissionRequestStatus;
  page: number;
  limit: number;
}
