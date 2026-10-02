import type { Request, RequestHandler } from 'express';
import { userActor } from '../../middlewares/authorize';
import { validated } from '../../middlewares/validate';
import { sendCreated, sendOk, sendPaginated } from '../../utils/api-response';
import type { IdParams } from '../../utils/object-id';
import { promotionsService, type PromotionsService } from './promotions.service';
import type {
  CreatePromotionBody,
  ListPromotionsQueryInput,
  PreviewQueryInput,
  UpdatePromotionBody,
} from './promotions.validation';

const actorOf = (req: Request) => {
  const actor = userActor(req);
  return { userId: actor.userId, role: actor.role };
};

/** HTTP only. Agency and platform routers share the handlers; scope rules live in the service. */
export class PromotionsController {
  constructor(private readonly service: PromotionsService = promotionsService) {}

  // ---- agency
  createAgency: RequestHandler = async (req, res) => {
    const { body } = validated<CreatePromotionBody>(req);
    sendCreated(res, await this.service.createForAgency(actorOf(req), body));
  };
  listAgency: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, ListPromotionsQueryInput>(req);
    const page = await this.service.listForAgency(userActor(req).userId, query);
    sendPaginated(res, page.items, page.meta);
  };
  getAgency: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, IdParams>(req);
    sendOk(res, await this.service.getForAgency(userActor(req).userId, params.id));
  };
  updateAgency: RequestHandler = async (req, res) => {
    const { params, body } = validated<UpdatePromotionBody, unknown, IdParams>(req);
    sendOk(res, await this.service.updateForAgency(actorOf(req), params.id, body));
  };

  // ---- platform (super admin)
  createPlatform: RequestHandler = async (req, res) => {
    const { body } = validated<CreatePromotionBody>(req);
    sendCreated(res, await this.service.createForPlatform(actorOf(req), body));
  };
  listPlatform: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, ListPromotionsQueryInput>(req);
    const page = await this.service.listForPlatform(query);
    sendPaginated(res, page.items, page.meta);
  };
  getPlatform: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, IdParams>(req);
    sendOk(res, await this.service.getForPlatform(params.id));
  };
  updatePlatform: RequestHandler = async (req, res) => {
    const { params, body } = validated<UpdatePromotionBody, unknown, IdParams>(req);
    sendOk(res, await this.service.updateForPlatform(actorOf(req), params.id, body));
  };

  // ---- checkout helper
  preview: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, PreviewQueryInput>(req);
    sendOk(res, await this.service.preview(query.code, query.tourId, query.subtotal));
  };
}

export const promotionsController = new PromotionsController();
