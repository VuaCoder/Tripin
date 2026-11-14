import type { RequestHandler } from 'express';
import { userActor } from '../../middlewares/authorize';
import { agencyContext } from '../../middlewares/agency-context';
import { validated } from '../../middlewares/validate';
import { sendCreated, sendOk, sendPaginated } from '../../utils/api-response';
import { agencyCommissionService, type AgencyCommissionService } from './agency-commission.service';
import type {
  ApproveCommissionRequestBody,
  CreateCommissionRequestBody,
  ListCommissionRequestsQueryInput,
  RejectCommissionRequestBody,
} from './agency-commission.validation';

type IdParams = { id: string };

export class AgencyCommissionController {
  constructor(private readonly service: AgencyCommissionService = agencyCommissionService) {}

  overview: RequestHandler = async (req, res) => {
    sendOk(res, await this.service.overview(agencyContext(req).agencyId));
  };

  create: RequestHandler = async (req, res) => {
    const { body } = validated<CreateCommissionRequestBody>(req);
    const ctx = agencyContext(req);
    sendCreated(res, await this.service.create({ agencyId: ctx.agencyId, actorUserId: ctx.actorUserId }, body));
  };

  cancel: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, IdParams>(req);
    const ctx = agencyContext(req);
    sendOk(res, await this.service.cancel(ctx.agencyId, ctx.actorUserId, params.id));
  };

  adminList: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, ListCommissionRequestsQueryInput>(req);
    const page = await this.service.listAdmin(query);
    sendPaginated(res, page.items, page.meta);
  };

  approve: RequestHandler = async (req, res) => {
    const { params, body } = validated<ApproveCommissionRequestBody, unknown, IdParams>(req);
    sendOk(res, await this.service.approve(userActor(req), params.id, body.note));
  };

  reject: RequestHandler = async (req, res) => {
    const { params, body } = validated<RejectCommissionRequestBody, unknown, IdParams>(req);
    sendOk(res, await this.service.reject(userActor(req), params.id, body.note));
  };
}

export const agencyCommissionController = new AgencyCommissionController();
