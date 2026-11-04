import { isUniqueViolation } from '../../config/database';
import { ROLES, type PersistedRole } from '@travel-platform/constants';
import { AppError } from '../../utils/app-error';
import { logger } from '../../utils/logger';
import { buildPage, type Page } from '../../utils/pagination';
import { assertTransition } from '../../utils/state-machine';
import { AUDIT_ACTIONS, auditService, type AuditService } from '../audit';
import { bookingsService, type BookingsService } from '../bookings';
import { NOTIFICATION_TYPE, notificationsService, type NotificationsService } from '../notifications';
import { reviewsService, type ReviewsService } from '../reviews';
import { toursService, type ToursService } from '../tours';
import { usersService, type UsersService } from '../users';
import { toComplaintDto, toModerationReportDto, toMyReportDto, type ReportExtras } from './reports.mapper';
import type { ReportRecord } from './reports.repository';
import { openReportKey, reportsRepository, type ReportsRepository } from './reports.repository';
import {
  REPORT_STATUS,
  REPORT_TARGET,
  REPORT_TRANSITIONS,
  type ComplaintDto,
  type CreateReportInput,
  type DisputeReviewInput,
  type ListModerationReportsQuery,
  type ListReportsQuery,
  type ModerationReportDto,
  type MyReportDto,
  type ReportStatus,
  type DirectChatDto,
  type RelatedTicketDto,
} from './reports.types';

type Actor = { userId: string; role: PersistedRole };
const ENTITY = 'Report';

export class ReportsService {
  constructor(
    private readonly reports: Pick<
      ReportsRepository,
      'create' | 'findById' | 'findOpenDuplicate' | 'transition' | 'listByReporter' | 'listByAgency' | 'listForModeration' | 'countByStatus' | 'countOpenForAgency'
    > & Partial<Pick<ReportsRepository, 'findRelatedTicket' | 'findDirectChat' | 'closeRelatedTicket'>> = reportsRepository,
    private readonly tours: Pick<ToursService, 'getTourFacts' | 'getTitles'> = toursService,
    private readonly users: Pick<UsersService, 'getSummaries'> = usersService,
    private readonly reviews: Pick<ReviewsService, 'getFacts'> = reviewsService,
    private readonly bookings: Pick<BookingsService, 'getFacts'> = bookingsService,
    private readonly notifications: Pick<NotificationsService, 'notify'> = notificationsService,
    private readonly audit: Pick<AuditService, 'record'> = auditService,
  ) {}

  // ================================================================ Traveler

  /**
   * Use case "Send report". The target is verified on the server, and the responsible agency / tour are derived from it
   * (never taken from the client). One open report per reporter and target.
   */
  async createReport(reporterId: string, input: CreateReportInput): Promise<MyReportDto> {
    const routing = await this.resolveTarget(input);
    if (input.bookingId) {
      const booking = await this.bookings.getFacts(input.bookingId);
      if (!booking || booking.travelerId !== reporterId) throw AppError.notFound('Booking not found');
    }
    if (await this.reports.findOpenDuplicate(reporterId, input.targetType, input.targetId)) {
      throw AppError.conflict('You already have an open report about this', 'REPORT_ALREADY_OPEN');
    }

    let report: ReportRecord;
    try {
      report = await this.reports.create({
        openKey: openReportKey(reporterId, input.targetType, input.targetId),
        reporterId: reporterId,
        targetType: input.targetType,
        targetId: input.targetId,
        category: input.category,
        description: input.description,
        ...(input.bookingId ? { bookingId: input.bookingId } : {}),
        ...(routing.agencyId ? { agencyId: routing.agencyId } : {}),
        ...(routing.tourId ? { tourId: routing.tourId } : {}),
      });
    } catch (error) {
      // Lost a race with an identical report filed at the same moment (unique index on `openKey`).
      if (isUniqueViolation(error)) throw AppError.conflict('You already have an open report about this', 'REPORT_ALREADY_OPEN');
      throw error;
    }

    if (routing.agencyId) {
      await this.notifications.notify(routing.agencyId, {
        type: NOTIFICATION_TYPE.COMPLAINT_RECEIVED,
        title: 'A traveler filed a report',
        body: `A report (${input.category}) was filed about your ${input.targetType === REPORT_TARGET.TOUR ? 'tour' : 'account'}. Please respond.`,
        data: { reportId: report.id },
      });
    }
    return toMyReportDto(report);
  }

  async listMine(reporterId: string, query: ListReportsQuery): Promise<Page<MyReportDto>> {
    const { items, total } = await this.reports.listByReporter(reporterId, query.status, query);
    return buildPage(items.map(toMyReportDto), total, query);
  }

  async getMine(reporterId: string, id: string): Promise<MyReportDto> {
    const report = await this.reports.findById(id);
    if (!report || report.reporterId !== reporterId) throw AppError.notFound('Report not found');
    return toMyReportDto(report);
  }

  // ================================================================== Agency

  /**
   * Use case "Dispute a review": an agency flags a review of one of its own tours as untrue. The same pipeline as a
   * traveler's report (one open dispute per review, the moderator queue decides), but the agency never picks the
   * target and may only dispute its own reviews. A dispute is not routed back to the agency as a complaint.
   */
  async disputeReview(agencyId: string, reviewId: string, input: DisputeReviewInput): Promise<MyReportDto> {
    const review = await this.reviews.getFacts(reviewId);
    if (!review || review.agencyId !== agencyId) throw AppError.notFound('Review not found');
    return this.createReport(agencyId, {
      targetType: REPORT_TARGET.REVIEW,
      targetId: reviewId,
      category: input.category,
      description: input.description,
    });
  }

  /** The disputes this agency filed (`GET /agency/review-disputes`). */
  listDisputes(agencyId: string, query: ListReportsQuery): Promise<Page<MyReportDto>> {
    return this.listMine(agencyId, query);
  }

  /** Use case "Handle tour complaints" (list): reports routed to this agency. */
  async listComplaints(agencyId: string, query: ListReportsQuery): Promise<Page<ComplaintDto>> {
    const { items, total } = await this.reports.listByAgency(agencyId, query.status, query);
    const people = await this.users.getSummaries(items.map((r) => r.reporterId));
    return buildPage(items.map((r) => toComplaintDto(r, people.get(r.reporterId)?.fullName)), total, query);
  }

  async getComplaint(agencyId: string, id: string): Promise<ComplaintDto> {
    const report = await this.requireOfAgency(agencyId, id);
    const people = await this.users.getSummaries([report.reporterId]);
    return toComplaintDto(report, people.get(report.reporterId)?.fullName);
  }

  /** Use case "Handle tour complaints": the agency answers once (OPEN -> AGENCY_RESPONDED); moderators decide afterwards. */
  async respondToComplaint(agencyId: string, id: string, text: string): Promise<ComplaintDto> {
    const report = await this.requireOfAgency(agencyId, id);
    assertTransition(REPORT_TRANSITIONS, report.status as ReportStatus, REPORT_STATUS.AGENCY_RESPONDED, ENTITY);

    const updated = await this.reports.transition(id, [REPORT_STATUS.OPEN], {
      status: REPORT_STATUS.AGENCY_RESPONDED,
      agencyResponse: { text, respondedAt: new Date(), by: agencyId },
    });
    if (!updated) throw AppError.conflict('The report changed, please retry', 'CONCURRENT_UPDATE');

    await this.notifications.notify(report.reporterId, {
      type: NOTIFICATION_TYPE.REPORT_UPDATED,
      title: 'The agency responded to your report',
      body: 'The agency answered your report. A moderator will review it.',
      data: { reportId: id },
    });
    const people = await this.users.getSummaries([updated.reporterId]);
    return toComplaintDto(updated, people.get(updated.reporterId)?.fullName);
  }

  // ============================================================== Moderation

  /** Called by `moderation` ("Resolve disputes"): the queue of reports. */
  async listForModeration(query: ListModerationReportsQuery): Promise<Page<ModerationReportDto>> {
    const { items, total } = await this.reports.listForModeration(query);
    const extras = await this.extrasFor(items);
    return buildPage(items.map((r) => toModerationReportDto(r, extras.get(r.id))), total, query);
  }

  async getForModeration(id: string): Promise<ModerationReportDto> {
    const report = await this.reports.findById(id);
    if (!report) throw AppError.notFound('Report not found');
    return toModerationReportDto(report, (await this.extrasFor([report])).get(report.id));
  }

  /** Called by `moderation`: closes a report as RESOLVED (upheld) or REJECTED (unfounded) with a note for the parties. */
  async resolve(actor: Actor, id: string, decision: { decision: 'RESOLVED' | 'REJECTED'; note: string }): Promise<ModerationReportDto> {
    const report = await this.reports.findById(id);
    if (!report) throw AppError.notFound('Report not found');
    const next = decision.decision === 'RESOLVED' ? REPORT_STATUS.RESOLVED : REPORT_STATUS.REJECTED;
    assertTransition(REPORT_TRANSITIONS, report.status as ReportStatus, next, ENTITY);

    const updated = await this.reports.transition(id, [report.status as ReportStatus], {
      status: next,
      resolution: { decision: next, note: decision.note, by: actor.userId, resolvedAt: new Date() },
      openKey: null, // a closed report no longer blocks a new one about the same target
    });
    if (!updated) throw AppError.conflict('The report changed, please retry', 'CONCURRENT_UPDATE');

    await this.audit.record({
      actorId: actor.userId,
      actorRole: actor.role,
      action: AUDIT_ACTIONS.REPORT_RESOLVED,
      targetType: 'report',
      targetId: id,
      metadata: { decision: next, note: decision.note },
    });
    const outcome = next === REPORT_STATUS.RESOLVED ? 'was upheld' : 'was not upheld';
    const notice = { title: 'Your report was reviewed', body: `A moderator reviewed your report and it ${outcome}: ${decision.note}`, data: { reportId: id } };
    await this.notifications.notify(report.reporterId, { type: NOTIFICATION_TYPE.REPORT_RESOLVED, ...notice }, { email: true });
    if (report.agencyId) {
      await this.notifications.notify(report.agencyId, {
        type: NOTIFICATION_TYPE.REPORT_UPDATED,
        title: 'A report about you was decided',
        body: `A moderator decided a report filed about you: ${next === REPORT_STATUS.RESOLVED ? 'upheld' : 'not upheld'}. ${decision.note}`,
        data: { reportId: id },
      });
    }

    // Automatically close any related complaint ticket so that both traveler and agency see the ticket closed immediately
    if (this.reports.findRelatedTicket && this.reports.closeRelatedTicket) {
      try {
        const relatedTicket = await this.reports.findRelatedTicket(
          report.reporterId,
          report.tourId,
          report.agencyId,
          report.bookingId,
        );
        if (relatedTicket && relatedTicket.status !== 'CLOSED') {
          const decisionWord = next === REPORT_STATUS.RESOLVED ? 'Chấp thuận' : 'Bác bỏ';
          await this.reports.closeRelatedTicket(
            relatedTicket.id,
            actor.userId,
            decisionWord,
            decision.note,
          );

          const ticketNotice = {
            type: NOTIFICATION_TYPE.COMPLAINT_RESOLVED,
            title: 'Phán quyết từ Kiểm duyệt viên sàn',
            body: `Kiểm duyệt viên đã phán quyết cho phiếu ${relatedTicket.ticketCode}: ${decisionWord}. ${decision.note}`,
            data: { ticketId: relatedTicket.id, ticketCode: relatedTicket.ticketCode },
          };
          await Promise.all([
            this.notifications.notify(relatedTicket.travelerId, ticketNotice, { email: true }),
            this.notifications.notify(relatedTicket.agencyId, ticketNotice, { email: true }),
          ]);
        }
      } catch (err) {
        logger.warn('Failed to auto-close related complaint ticket for report', { reportId: id, err });
      }
    }

    return toModerationReportDto(updated, (await this.extrasFor([updated])).get(updated.id));
  }

  /** Reports per status (dashboards). */
  async countByStatus(): Promise<Record<string, number>> {
    const rows = await this.reports.countByStatus();
    return Object.fromEntries(rows.map((row) => [row.status, row.count]));
  }

  /** Complaints of one agency still waiting for its answer. */
  countOpenForAgency(agencyId: string): Promise<number> {
    return this.reports.countOpenForAgency(agencyId);
  }

  // =============================================================== helpers

  /** Verifies the reported thing exists and derives who must answer (agency) and which tour it concerns. */
  private async resolveTarget(input: CreateReportInput): Promise<{ agencyId?: string; tourId?: string }> {
    switch (input.targetType) {
      case REPORT_TARGET.TOUR: {
        const tour = await this.tours.getTourFacts(input.targetId);
        if (!tour) throw AppError.notFound('Tour not found');
        return { agencyId: tour.agencyId, tourId: tour.id };
      }
      case REPORT_TARGET.USER: {
        const target = (await this.users.getSummaries([input.targetId])).get(input.targetId);
        if (!target || (target.role !== ROLES.AGENCY && target.role !== ROLES.TOUR_GUIDE)) throw AppError.notFound('Account not found');
        return target.role === ROLES.AGENCY ? { agencyId: target.id } : {};
      }
      case REPORT_TARGET.REVIEW: {
        const review = await this.reviews.getFacts(input.targetId);
        if (!review) throw AppError.notFound('Review not found');
        return { tourId: review.tourId };
      }
    }
  }

  /** 404 (never 403) when the report was not routed to this agency. */
  private async requireOfAgency(agencyId: string, id: string): Promise<ReportRecord> {
    const report = await this.reports.findById(id);
    if (!report || !report.agencyId || report.agencyId !== agencyId) throw AppError.notFound('Report not found');
    return report;
  }

  /**
   * What a page of reports resolves to for display: names in batched lookups (never raw ids) and, for a report
   * about a review, the review itself. An account, tour or booking that no longer exists simply has no name.
   */
  private async extrasFor(items: ReportRecord[]): Promise<Map<string, ReportExtras>> {
    const reviewIds = Array.from(new Set(items.filter((r) => r.targetType === REPORT_TARGET.REVIEW).map((r) => r.targetId)));
    const reviews = new Map(
      (await Promise.all(reviewIds.map((id) => this.reviews.getFacts(id)))).flatMap((facts) => (facts ? [[facts.id, facts] as const] : [])),
    );

    const userIds = items.flatMap((r) => {
      const author = r.targetType === REPORT_TARGET.REVIEW ? reviews.get(r.targetId)?.travelerId : undefined;
      return [r.reporterId, ...(r.agencyId ? [r.agencyId] : []), ...(r.targetType === REPORT_TARGET.USER ? [r.targetId] : []), ...(author ? [author] : [])];
    });
    const tourIds = items.flatMap((r) => [
      ...(r.tourId ? [r.tourId] : []),
      ...(r.targetType === REPORT_TARGET.TOUR ? [r.targetId] : []),
    ]);
    const bookingIds = Array.from(new Set(items.flatMap((r) => (r.bookingId ? [r.bookingId] : []))));
    const [people, titles, bookings] = await Promise.all([
      this.users.getSummaries(userIds),
      this.tours.getTitles(tourIds),
      Promise.all(bookingIds.map((id) => this.bookings.getFacts(id))),
    ]);
    const codes = new Map(bookings.flatMap((booking) => (booking ? [[booking.id, booking.bookingCode] as const] : [])));

    const relatedTickets = new Map<string, RelatedTicketDto>();
    const directChats = new Map<string, DirectChatDto>();

    if (this.reports.findRelatedTicket) {
      await Promise.all(
        items.map(async (report) => {
          try {
            const ticket = await this.reports.findRelatedTicket!(
              report.reporterId,
              report.tourId,
              report.agencyId,
              report.bookingId,
            );
            if (ticket) {
              relatedTickets.set(report.id, {
                id: ticket.id,
                ticketCode: ticket.ticketCode,
                status: ticket.status,
                subject: ticket.subject,
                messages: ticket.messages.map((m) => ({
                  id: m.id,
                  senderRole: m.senderRole,
                  senderName: (m as any).senderName ?? undefined,
                  text: m.text,
                  attachments: m.attachments,
                  createdAt: m.createdAt.toISOString(),
                })),
              });
            }
          } catch {
            // graceful fallback
          }
        }),
      );
    }

    if (this.reports.findDirectChat) {
      await Promise.all(
        items.map(async (report) => {
          if (!report.agencyId) return;
          try {
            const chat = await this.reports.findDirectChat!(report.reporterId, report.agencyId);
            if (chat && chat.messages.length > 0) {
              directChats.set(report.id, {
                id: chat.id,
                messages: chat.messages.map((m) => ({
                  id: m.id,
                  senderId: m.senderId,
                  text: m.text,
                  createdAt: m.createdAt.toISOString(),
                })),
              });
            }
          } catch {
            // graceful fallback
          }
        }),
      );
    }

    const accountName = (id?: string | null) => {
      const account = id ? people.get(id) : undefined;
      return account ? (account.companyName ?? account.fullName) : undefined;
    };
    return new Map(
      items.map((report) => {
        // A report about a review is named by the tour that review is about (the report's own `tourId`).
        const targetName =
          report.targetType === REPORT_TARGET.TOUR
            ? titles.get(report.targetId)
            : report.targetType === REPORT_TARGET.USER
              ? accountName(report.targetId)
              : report.tourId
                ? titles.get(report.tourId)
                : undefined;
        const facts = report.targetType === REPORT_TARGET.REVIEW ? reviews.get(report.targetId) : undefined;
        return [
          report.id,
          {
            reporterName: people.get(report.reporterId)?.fullName,
            targetName,
            agencyName: accountName(report.agencyId),
            tourTitle: report.tourId ? titles.get(report.tourId) : undefined,
            bookingCode: report.bookingId ? codes.get(report.bookingId) : undefined,
            review: facts
              ? {
                  rating: facts.rating,
                  comment: facts.comment,
                  status: facts.status as 'VISIBLE' | 'HIDDEN',
                  hiddenReason: facts.hiddenReason,
                  authorName: people.get(facts.travelerId)?.fullName,
                }
              : undefined,
            relatedTicket: relatedTickets.get(report.id),
            directChat: directChats.get(report.id),
          },
        ];
      }),
    );
  }
}

export const reportsService = new ReportsService();
