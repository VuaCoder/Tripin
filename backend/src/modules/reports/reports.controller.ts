import type { RequestHandler } from 'express';
import { userActor } from '../../middlewares/authorize';
import { validated } from '../../middlewares/validate';
import { sendCreated, sendOk, sendPaginated } from '../../utils/api-response';
import type { IdParams } from '../../utils/id';
import { reportsService, type ReportsService } from './reports.service';
import type { ReportStatus, ReportTarget, ReportCategory } from './reports.types';
import type { CreateReportBody, DisputeReviewBody, ListReportsQueryInput, RespondBody, ReviewIdParams } from './reports.validation';

/** HTTP only. Reporter / agency are always the authenticated user; routing data is derived server-side. */
export class ReportsController {
  constructor(private readonly service: ReportsService = reportsService) {}

  create: RequestHandler = async (req, res) => {
    const { body } = validated<CreateReportBody>(req);
    sendCreated(
      res,
      await this.service.createReport(userActor(req).userId, {
        ...body,
        targetType: body.targetType as ReportTarget,
        category: body.category as ReportCategory,
      }),
    );
  };

  listMine: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, ListReportsQueryInput>(req);
    const page = await this.service.listMine(userActor(req).userId, { ...query, status: query.status as ReportStatus | undefined });
    sendPaginated(res, page.items, page.meta);
  };

  getMine: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, IdParams>(req);
    sendOk(res, await this.service.getMine(userActor(req).userId, params.id));
  };

  listComplaints: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, ListReportsQueryInput>(req);
    const page = await this.service.listComplaints(userActor(req).userId, { ...query, status: query.status as ReportStatus | undefined });
    sendPaginated(res, page.items, page.meta);
  };

  /** An agency disputes a review of one of its own tours. */
  disputeReview: RequestHandler = async (req, res) => {
    const { params, body } = validated<DisputeReviewBody, unknown, ReviewIdParams>(req);
    sendCreated(
      res,
      await this.service.disputeReview(userActor(req).userId, params.reviewId, {
        category: body.category as ReportCategory,
        description: body.description,
      }),
    );
  };

  /** The disputes this agency filed, so it can follow their outcome without waiting for a notification. */
  listDisputes: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, ListReportsQueryInput>(req);
    const page = await this.service.listDisputes(userActor(req).userId, { ...query, status: query.status as ReportStatus | undefined });
    sendPaginated(res, page.items, page.meta);
  };

  getComplaint: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, IdParams>(req);
    sendOk(res, await this.service.getComplaint(userActor(req).userId, params.id));
  };

  respond: RequestHandler = async (req, res) => {
    const { params, body } = validated<RespondBody, unknown, IdParams>(req);
    sendOk(res, await this.service.respondToComplaint(userActor(req).userId, params.id, body.text));
  };
}

export const reportsController = new ReportsController();
