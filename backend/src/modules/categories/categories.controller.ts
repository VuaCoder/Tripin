import type { RequestHandler } from 'express';
import { userActor } from '../../middlewares/authorize';
import { validated } from '../../middlewares/validate';
import { sendCreated, sendNoContent, sendOk } from '../../utils/api-response';
import type { IdParams } from '../../utils/object-id';
import { categoriesService, type CategoriesService } from './categories.service';
import type { CreateCategoryBody, UpdateCategoryBody } from './categories.validation';

const actorOf = (req: Parameters<RequestHandler>[0]) => {
  const actor = userActor(req);
  return { userId: actor.userId, role: actor.role };
};

export class CategoriesController {
  constructor(private readonly service: CategoriesService = categoriesService) {}

  listPublic: RequestHandler = async (_req, res) => {
    sendOk(res, await this.service.listPublic());
  };

  listAll: RequestHandler = async (_req, res) => {
    sendOk(res, await this.service.listAll());
  };

  create: RequestHandler = async (req, res) => {
    const { body } = validated<CreateCategoryBody>(req);
    sendCreated(res, await this.service.create(actorOf(req), body));
  };

  update: RequestHandler = async (req, res) => {
    const { params, body } = validated<UpdateCategoryBody, unknown, IdParams>(req);
    sendOk(res, await this.service.update(actorOf(req), params.id, body));
  };

  remove: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, IdParams>(req);
    await this.service.deactivate(actorOf(req), params.id);
    sendNoContent(res);
  };
}

export const categoriesController = new CategoriesController();
