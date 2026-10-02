import { isUniqueViolation } from '../../config/database';
import { ROLES, type PersistedRole } from '@travel-platform/constants';
import { AppError } from '../../utils/app-error';
import { buildPage, type Page } from '../../utils/pagination';
import { assertTransition } from '../../utils/state-machine';
import { AUDIT_ACTIONS, auditService, type AuditService } from '../audit';
import { bookingsService, type BookingsService } from '../bookings';
import { NOTIFICATION_TYPE, notificationsService, type NotificationsService } from '../notifications';
import { reviewsService, type ReviewsService } from '../reviews';
import { toursService, type ToursService } from '../tours';
import { usersService, type UsersService } from '../users';
import { toComplaintDto, toModerationReportDto, toMyReportDto } from './reports.mapper';
import type { ReportRecord } from './reports.repository';
import { openReportKey, reportsRepository, type ReportsRepository } from './reports.repository';
import {
  REPORT_STATUS,
  REPORT_TARGET,
  REPORT_TRANSITIONS,
  type ComplaintDto,
  type CreateReportInput,
  type ListModerationReportsQuery,
  type ListReportsQuery,
  type ModerationReportDto,
  type MyReportDto,
  type ReportStatus,
} from './reports.types';

type Actor = { userId: string; role: PersistedRole };
const ENTITY = 'Report';

export class ReportsService {
  constructor(
    private readonly reports: Pick<
      ReportsRepository,
      'create' | 'findById' | 'findOpenDuplicate' | 'transition' | 'listByReporter' | 'listByAgency' | 'listForModeration' | 'countByStatus' | 'countOpenForAgency'
    > = reportsRepository,
    private readonly tours: Pick<ToursService, 'getTourFacts'> = toursService,
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
    return buildPage(items.map(toModerationReportDto), total, query);
  }

  async getForModeration(id: string): Promise<ModerationReportDto> {
    const report = await this.reports.findById(id);
    if (!report) throw AppError.notFound('Report not found');
    return toModerationReportDto(report);
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
    return toModerationReportDto(updated);
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
}

export const reportsService = new ReportsService();
