import type { AgencyBookingStats, PlatformBookingStats } from '../bookings';

export const DASHBOARD_CACHE_TTL_MS = 30_000;

export interface AgencyDashboardDto {
  generatedAt: string;
  tours: { total: number; byStatus: Record<string, number> };
  bookings: AgencyBookingStats['byStatus'] & Record<string, number>;
  revenue: AgencyBookingStats['totals'];
  last30Days: AgencyBookingStats['last30Days'];
  topTours: AgencyBookingStats['topTours'];
  /** Complaints routed to this agency that it has not answered yet. */
  openComplaints: number;
}

export interface ModerationDashboardDto {
  generatedAt: string;
  /** Work waiting for a decision. */
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

export interface AdminDashboardDto {
  generatedAt: string;
  users: { total: number; byRole: Record<string, number>; byStatus: Record<string, number>; newLast30Days: number };
  tours: { total: number; byStatus: Record<string, number> };
  bookings: { byStatus: Record<string, number> };
  revenue: PlatformBookingStats['totals'] & { subscriptions: { amount: number; count: number } };
  monthly: PlatformBookingStats['monthly'];
  subscriptions: { active: number };
  moderation: { reportsOpen: number; supportTicketsOpen: number };
}
