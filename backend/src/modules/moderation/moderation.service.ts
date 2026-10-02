import type { AgencyVerificationStatus, PersistedRole } from '@travel-platform/constants';
import type { Page } from '../../utils/pagination';
import { NOTIFICATION_TYPE, notificationsService, type NotificationsService } from '../notifications';
import { reportsService, type ReportsService } from '../reports';
import type { ModerationReportDto } from '../reports';
import { reviewsService, type ReviewsService, type ModerationReviewDto } from '../reviews';
import { supportService, type SupportService, type ModerationTicketDto, type TicketSummaryDto } from '../support';
import { toursService, type ToursService, type ListTourFilter, type TourManageDto } from '../tours';
import { usersService, type PrivateUserDto, type UsersService } from '../users';

type Actor = { userId: string; role: PersistedRole };
type PageQuery = { page: number; limit: number };

/**
 * Staff workbench. This module owns NO data: every use case of the Moderator is a call to the module that owns the
 * entity (and therefore its state machine, audit trail and notifications). Permissions are enforced on the routes
 * (`moderation.routes.ts`); the rules below are the ones that cut across modules.
 */
export class ModerationService {
  constructor(
    private readonly tours: Pick<ToursService, 'listForModeration' | 'getForModeration' | 'decideReview' | 'suspendTour'> = toursService,
    private readonly users: Pick<UsersService, 'listAgenciesByVerification' | 'decideAgencyVerification' | 'banUser' | 'unbanUser'> = usersService,
    private readonly reviews: Pick<ReviewsService, 'listForModeration' | 'moderate'> = reviewsService,
    private readonly reports: Pick<ReportsService, 'listForModeration' | 'getForModeration' | 'resolve'> = reportsService,
    private readonly support: Pick<SupportService, 'listForModeration' | 'getForModeration' | 'replyAsStaff' | 'setStatus'> = supportService,
    private readonly notifications: Pick<NotificationsService, 'notify'> = notificationsService,
  ) {}

  // -------------------------------------------------------------- Tours

  /** Use case "View tour lists": every status, filterable. */
  listTours(filter: ListTourFilter, page: PageQuery): Promise<Page<TourManageDto>> {
    return this.tours.listForModeration(filter, page);
  }

  getTour(id: string): Promise<TourManageDto> {
    return this.tours.getForModeration(id);
  }

  /** Use case "Validate tour". */
  validateTour(actor: Actor, id: string, decision: { approve: boolean; reason?: string }): Promise<TourManageDto> {
    return this.tours.decideReview(actor, id, decision);
  }

  /** Use case "Suspend tours". */
  suspendTour(actor: Actor, id: string, reason: string): Promise<TourManageDto> {
    return this.tours.suspendTour(actor, id, reason);
  }

  // ----------------------------------------------------------- Agencies

  /** Agencies filtered by verification status (default: waiting for a decision). */
  listAgencies(status: AgencyVerificationStatus, page: PageQuery): Promise<Page<PrivateUserDto>> {
    return this.users.listAgenciesByVerification(status, page);
  }

  /** Use case "Verify Agency Profile". The agency is told by app and email. */
  async verifyAgency(actor: Actor, agencyId: string, decision: { approve: boolean; note?: string }): Promise<PrivateUserDto> {
    const agency = await this.users.decideAgencyVerification(actor, agencyId, decision);
    await this.notifications.notify(
      agencyId,
      {
        type: NOTIFICATION_TYPE.AGENCY_VERIFICATION_DECIDED,
        title: decision.approve ? 'Your agency was verified' : 'Your agency verification was rejected',
        body: decision.approve
          ? 'Your agency profile is verified. You can now submit tours for review.'
          : `Your verification request was rejected${decision.note ? `: ${decision.note}` : '.'} You can update your profile and request it again.`,
      },
      { email: true },
    );
    return agency;
  }

  // ------------------------------------------------------------ Reviews

  /** Use case "Moderate reviews" (list). */
  listReviews(query: PageQuery & { status?: 'VISIBLE' | 'HIDDEN'; tourId?: string }): Promise<Page<ModerationReviewDto>> {
    return this.reviews.listForModeration(query);
  }

  moderateReview(actor: Actor, id: string, decision: { hide: boolean; reason?: string }): Promise<ModerationReviewDto> {
    return this.reviews.moderate(actor, id, decision);
  }

  // ----------------------------------------------------------- Accounts

  /** Use case "Ban violating account". The account is blocked immediately (the actor is re-read on every request). */
  banUser(actor: Actor, userId: string, reason: string): Promise<PrivateUserDto> {
    return this.users.banUser(actor, userId, reason);
  }

  unbanUser(actor: Actor, userId: string): Promise<PrivateUserDto> {
    return this.users.unbanUser(actor, userId);
  }

  // ------------------------------------------- Disputes (reports) & tickets

  /** Use case "Resolve disputes": the reports queue. */
  listReports(query: Parameters<ReportsService['listForModeration']>[0]): Promise<Page<ModerationReportDto>> {
    return this.reports.listForModeration(query);
  }

  getReport(id: string): Promise<ModerationReportDto> {
    return this.reports.getForModeration(id);
  }

  resolveReport(actor: Actor, id: string, decision: { decision: 'RESOLVED' | 'REJECTED'; note: string }): Promise<ModerationReportDto> {
    return this.reports.resolve(actor, id, decision);
  }

  /** Use case "Handle complaints": the support queue. */
  listTickets(query: Parameters<SupportService['listForModeration']>[0]): Promise<Page<TicketSummaryDto>> {
    return this.support.listForModeration(query);
  }

  getTicket(id: string): Promise<ModerationTicketDto> {
    return this.support.getForModeration(id);
  }

  replyToTicket(actor: Actor, id: string, input: { text: string; resolve?: boolean }): Promise<ModerationTicketDto> {
    return this.support.replyAsStaff(actor, id, input);
  }

  setTicketStatus(actor: Actor, id: string, status: 'IN_PROGRESS' | 'RESOLVED'): Promise<ModerationTicketDto> {
    return this.support.setStatus(actor, id, status);
  }
}

export const moderationService = new ModerationService();
