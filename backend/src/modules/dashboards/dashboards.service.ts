import type { DateRange } from '../../utils/date-range';
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
        customers: stats.customers,
        last30Days: stats.last30Days,
        last6Months: stats.last6Months,
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
  adminDashboard(range?: DateRange): Promise<AdminDashboardDto> {
    const key = range ? `${range.from.toISOString()}/${range.to.toISOString()}` : 'all';
    return this.adminCache.getOrCompute(key, async () => {
      const now = new Date();
      const duration = range ? range.to.getTime() - range.from.getTime() + 1 : 0;
      const previous = range ? { from: new Date(range.from.getTime() - duration), to: new Date(range.from.getTime() - 1) } : undefined;
      const [userStats, tourCounts, platform, subscriptionRevenue, activeSubscriptions, reportCounts, ticketCounts] = await Promise.all([
        this.users.getStats(),
        this.tours.countByStatus(),
        range ? this.bookings.getPlatformStats(now, range) : this.bookings.getPlatformStats(),
        range ? this.payments.paidTotal(PAYMENT_PURPOSE.SUBSCRIPTION, range) : this.payments.paidTotal(PAYMENT_PURPOSE.SUBSCRIPTION),
        this.subscriptions.countActive(),
        this.reports.countByStatus(),
        this.support.countByStatus(),
      ]);
      const prior = previous ? await Promise.all([
        this.bookings.getPlatformStats(now, previous),
        this.payments.paidTotal(PAYMENT_PURPOSE.SUBSCRIPTION, previous),
      ]) : undefined;
      // Zero-fill UTC months in the selected period; legacy unfiltered responses retain their contract.
      const monthly = range ? (() => {
        const rows = new Map(platform.monthly.map((row) => [row.month, row]));
        const result: AdminDashboardDto['monthly'] = [];
        const cursor = new Date(Date.UTC(range.from.getUTCFullYear(), range.from.getUTCMonth(), 1));
        while (cursor <= range.to) {
          const month = cursor.toISOString().slice(0, 7);
          result.push(rows.get(month) ?? { month, bookings: 0, gross: 0, commission: 0 });
          cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        }
        return result;
      })() : platform.monthly;
      return {
        ...(range && previous && prior ? {
          period: { from: range.from.toISOString(), to: range.to.toISOString(), previousFrom: previous.from.toISOString(), previousTo: previous.to.toISOString() },
          comparison: { ...prior[0].totals, subscriptions: prior[1] },
        } : {}),
        generatedAt: new Date().toISOString(),
        users: { total: sum(userStats.byRole), byRole: userStats.byRole, byStatus: userStats.byStatus, newLast30Days: userStats.newLast30Days },
        tours: { total: sum(tourCounts), byStatus: tourCounts },
        bookings: { byStatus: platform.byStatus },
        revenue: { ...platform.totals, subscriptions: subscriptionRevenue },
        monthly,
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
