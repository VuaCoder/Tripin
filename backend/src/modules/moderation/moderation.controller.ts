import type { Request, RequestHandler } from 'express';
import type { AgencyVerificationStatus, TourStatus } from '@travel-platform/constants';
import { userActor } from '../../middlewares/authorize';
import { validated } from '../../middlewares/validate';
import { sendOk, sendPaginated } from '../../utils/api-response';
import type { IdParams } from '../../utils/object-id';
import type { ReportCategory, ReportStatus, ReportTarget } from '../reports';
import type { ReviewStatus } from '../reviews';
import type { TicketCategory, TicketStatus } from '../support';
import { moderationService, type ModerationService } from './moderation.service';
import type {
  BanBody,
  ListAgenciesQueryInput,
  ListReportsQueryInput,
  ListReviewsQueryInput,
  ListTicketsQueryInput,
  ListToursQueryInput,
  ModerateReviewBody,
  ResolveReportBody,
  SuspendTourBody,
  TicketReplyBody,
  TicketStatusBody,
  ValidateTourBody,
  VerifyAgencyBody,
} from './moderation.validation';

const actorOf = (req: Request) => {
  const actor = userActor(req);
  return { userId: actor.userId, role: actor.role };
};

/** HTTP only; the staff member acting is always the authenticated user. */
export class ModerationController {
  constructor(private readonly service: ModerationService = moderationService) {}

  // ---- tours
  listTours: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, ListToursQueryInput>(req);
    const page = await this.service.listTours(
      { status: query.status as TourStatus | undefined, q: query.q, agencyId: query.agencyId },
      { page: query.page, limit: query.limit },
    );
    sendPaginated(res, page.items, page.meta);
  };
  getTour: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, IdParams>(req);
    sendOk(res, await this.service.getTour(params.id));
  };
  validateTour: RequestHandler = async (req, res) => {
    const { params, body } = validated<ValidateTourBody, unknown, IdParams>(req);
    sendOk(res, await this.service.validateTour(actorOf(req), params.id, body));
  };
  suspendTour: RequestHandler = async (req, res) => {
    const { params, body } = validated<SuspendTourBody, unknown, IdParams>(req);
    sendOk(res, await this.service.suspendTour(actorOf(req), params.id, body.reason));
  };

  // ---- agencies
  listAgencies: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, ListAgenciesQueryInput>(req);
    const page = await this.service.listAgencies(query.status as AgencyVerificationStatus, { page: query.page, limit: query.limit });
    sendPaginated(res, page.items, page.meta);
  };
  verifyAgency: RequestHandler = async (req, res) => {
    const { params, body } = validated<VerifyAgencyBody, unknown, IdParams>(req);
    sendOk(res, await this.service.verifyAgency(actorOf(req), params.id, body));
  };

  // ---- reviews
  listReviews: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, ListReviewsQueryInput>(req);
    const page = await this.service.listReviews({ ...query, status: query.status as ReviewStatus | undefined });
    sendPaginated(res, page.items, page.meta);
  };
  moderateReview: RequestHandler = async (req, res) => {
    const { params, body } = validated<ModerateReviewBody, unknown, IdParams>(req);
    sendOk(res, await this.service.moderateReview(actorOf(req), params.id, body));
  };

  // ---- accounts
  ban: RequestHandler = async (req, res) => {
    const { params, body } = validated<BanBody, unknown, IdParams>(req);
    sendOk(res, await this.service.banUser(actorOf(req), params.id, body.reason));
  };
  unban: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, IdParams>(req);
    sendOk(res, await this.service.unbanUser(actorOf(req), params.id));
  };

  // ---- reports
  listReports: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, ListReportsQueryInput>(req);
    const page = await this.service.listReports({
      ...query,
      status: query.status as ReportStatus | undefined,
      targetType: query.targetType as ReportTarget | undefined,
      category: query.category as ReportCategory | undefined,
    });
    sendPaginated(res, page.items, page.meta);
  };
  getReport: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, IdParams>(req);
    sendOk(res, await this.service.getReport(params.id));
  };
  resolveReport: RequestHandler = async (req, res) => {
    const { params, body } = validated<ResolveReportBody, unknown, IdParams>(req);
    sendOk(res, await this.service.resolveReport(actorOf(req), params.id, body as { decision: 'RESOLVED' | 'REJECTED'; note: string }));
  };

  // ---- support tickets
  listTickets: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, ListTicketsQueryInput>(req);
    const page = await this.service.listTickets({
      ...query,
      status: query.status as TicketStatus | undefined,
      category: query.category as TicketCategory | undefined,
    });
    sendPaginated(res, page.items, page.meta);
  };
  getTicket: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, IdParams>(req);
    sendOk(res, await this.service.getTicket(params.id));
  };
  replyToTicket: RequestHandler = async (req, res) => {
    const { params, body } = validated<TicketReplyBody, unknown, IdParams>(req);
    sendOk(res, await this.service.replyToTicket(actorOf(req), params.id, body));
  };
  setTicketStatus: RequestHandler = async (req, res) => {
    const { params, body } = validated<TicketStatusBody, unknown, IdParams>(req);
    sendOk(res, await this.service.setTicketStatus(actorOf(req), params.id, body.status as 'IN_PROGRESS' | 'RESOLVED'));
  };
}

export const moderationController = new ModerationController();
