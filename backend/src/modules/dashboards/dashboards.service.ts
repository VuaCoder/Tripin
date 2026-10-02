import { PAYMENT_PURPOSE } from '@travel-platform/constants';
import { TtlCache } from '../../utils/ttl-cache';
import { bookingsService, type BookingsService } from '../bookings';
import { paymentsService, type PaymentsService } from '../payments';
import { reportsService, type ReportsService } from '../reports';
import { reviewsService, type ReviewsService } from '../reviews';
import { subscriptionsService, type SubscriptionsService } from '../subscriptions';
import { supportService, type SupportService } from '../support';
import { toursService, type ToursService } from '../tours';
import { usersService, type UsersService } from '../users';
import {
  DASHBOARD_CACHE_TTL_MS,
  type AdminDashboardDto,
  type AgencyDashboardDto,
  type ModerationDashboardDto,
} from './dashboards.types';

const sum = (record: Record<string, number>) => Object.values(record).reduce((a, b) => a + b, 0);

/**
 * Read models for the three dashboards. This module owns no data: every figure comes from a stats method of the
 * module that owns the collection. Results are cached for 30 s (per agency for the agency dashboard).
 */
export class DashboardsService {
  private readonly agencyCache = new TtlCache<AgencyDashboardDto>(DASHBOARD_CACHE_TTL_MS);
  private readonly moderationCache = new TtlCache<ModerationDashboardDto>(DASHBOARD_CACHE_TTL_MS);
  private readonly adminCache = new TtlCache<AdminDashboardDto>(DASHBOARD_CACHE_TTL_MS);

  constructor(
    private readonly bookings: Pick<BookingsService, 'getAgencyStats' | 'getPlatformStats'> = bookingsService,
    private readonly tours: Pick<ToursService, 'countByStatus'> = toursService,
    private readonly users: Pick<UsersService, 'getStats'> = usersService,
    private readonly reports: Pick<ReportsService, 'countByStatus' | 'countOpenForAgency'> = reportsService,
    private readonly support: Pick<SupportService, 'countByStatus'> = supportService,
    private readonly reviews: Pick<ReviewsService, 'countByStatus'> = reviewsService,
    private readonly payments: Pick<PaymentsService, 'paidTotal'> = paymentsService,
    private readonly subscriptions: Pick<SubscriptionsService, 'countActive'> = subscriptionsService,
  ) {}

  /** Use case "View dashboard" (Agency): ONLY the agency's own numbers, the id comes from the token. */
  agencyDashboard(agencyId: string): Promise<AgencyDashboardDto> {
    return this.agencyCache.getOrCompute(agencyId, async () => {
      const [stats, tourCounts, openComplaints] = await Promise.all([
        this.bookings.getAgencyStats(agencyId),
        this.tours.countByStatus(agencyId),
        this.reports.countOpenForAgency(agencyId),
      ]);
      return {
        generatedAt: new Date().toISOString(),
        tours: { total: sum(tourCounts), byStatus: tourCounts },
        bookings: stats.byStatus,
        revenue: stats.totals,
        last30Days: stats.last30Days,
        topTours: stats.topTours,
        openComplaints,
      };
    });
  }

  /** Use case "View moderation dashboard": the queues that need a human. */
  moderationDashboard(): Promise<ModerationDashboardDto> {
    return this.moderationCache.getOrCompute('all', async () => {
      const [tourCounts, userStats, reportCounts, ticketCounts, reviewCounts] = await Promise.all([
        this.tours.countByStatus(),
        this.users.getStats(),
        this.reports.countByStatus(),
        this.support.countByStatus(),
        this.reviews.countByStatus(),
      ]);
      return {
        generatedAt: new Date().toISOString(),
        queues: {
          toursPendingReview: tourCounts.PENDING_REVIEW ?? 0,
          agenciesPendingVerification: userStats.agenciesPendingVerification,
          reportsOpen: reportCounts.OPEN ?? 0,
          reportsAwaitingDecision: reportCounts.AGENCY_RESPONDED ?? 0,
          supportTicketsOpen: ticketCounts.OPEN ?? 0,
          supportTicketsInProgress: ticketCounts.IN_PROGRESS ?? 0,
        },
        tours: tourCounts,
        reviews: { visible: reviewCounts.VISIBLE ?? 0, hidden: reviewCounts.HIDDEN ?? 0 },
      };
    });
  }

  /** Use case "View detailed dashboards" (Super admin): platform-wide figures. */
  adminDashboard(): Promise<AdminDashboardDto> {
    return this.adminCache.getOrCompute('all', async () => {
      const [userStats, tourCounts, platform, subscriptionRevenue, activeSubscriptions, reportCounts, ticketCounts] = await Promise.all([
        this.users.getStats(),
        this.tours.countByStatus(),
        this.bookings.getPlatformStats(),
        this.payments.paidTotal(PAYMENT_PURPOSE.SUBSCRIPTION),
        this.subscriptions.countActive(),
        this.reports.countByStatus(),
        this.support.countByStatus(),
      ]);
      return {
        generatedAt: new Date().toISOString(),
        users: { total: sum(userStats.byRole), byRole: userStats.byRole, byStatus: userStats.byStatus, newLast30Days: userStats.newLast30Days },
        tours: { total: sum(tourCounts), byStatus: tourCounts },
        bookings: { byStatus: platform.byStatus },
        revenue: { ...platform.totals, subscriptions: subscriptionRevenue },
        monthly: platform.monthly,
        subscriptions: { active: activeSubscriptions },
        moderation: {
          reportsOpen: (reportCounts.OPEN ?? 0) + (reportCounts.AGENCY_RESPONDED ?? 0),
          supportTicketsOpen: (ticketCounts.OPEN ?? 0) + (ticketCounts.IN_PROGRESS ?? 0),
        },
      };
    });
  }
}

export const dashboardsService = new DashboardsService();
