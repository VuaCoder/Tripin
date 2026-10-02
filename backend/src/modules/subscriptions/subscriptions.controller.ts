import type { RequestHandler } from 'express';
import { userActor } from '../../middlewares/authorize';
import { validated } from '../../middlewares/validate';
import { sendCreated, sendOk, sendPaginated } from '../../utils/api-response';
import { subscriptionsService, type SubscriptionsService } from './subscriptions.service';
import type { ListMySubscriptionsQueryInput, SubscribeBody } from './subscriptions.validation';

/** HTTP only. The subscriber is always the authenticated tour guide; price comes from the plan. */
export class SubscriptionsController {
  constructor(private readonly service: SubscriptionsService = subscriptionsService) {}

  listPlans: RequestHandler = async (_req, res) => {
    sendOk(res, await this.service.listPlans());
  };

  subscribe: RequestHandler = async (req, res) => {
    const { body } = validated<SubscribeBody>(req);
    sendCreated(res, await this.service.subscribe(userActor(req).userId, body.planId));
  };

  listMine: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, ListMySubscriptionsQueryInput>(req);
    const page = await this.service.listMine(userActor(req).userId, query);
    sendPaginated(res, page.items, page.meta);
  };

  current: RequestHandler = async (req, res) => {
    sendOk(res, await this.service.getCurrent(userActor(req).userId));
  };
}

export const subscriptionsController = new SubscriptionsController();
