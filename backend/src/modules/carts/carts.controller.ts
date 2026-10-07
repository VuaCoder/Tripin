import type { RequestHandler } from 'express';
import { userActor } from '../../middlewares/authorize';
import { validated } from '../../middlewares/validate';
import { sendNoContent, sendOk } from '../../utils/api-response';
import type { IdParams } from '../../utils/id';
import { cartsService, type CartsService } from './carts.service';
import type { AddCartItemBody, UpdateCartItemBody } from './carts.validation';

/** HTTP only. The cart owner is ALWAYS the logged-in user; no user id is accepted from the client. */
export class CartsController {
  constructor(private readonly service: CartsService = cartsService) {}

  get: RequestHandler = async (req, res) => {
    sendOk(res, await this.service.list(userActor(req).userId));
  };

  add: RequestHandler = async (req, res) => {
    const { body } = validated<AddCartItemBody>(req);
    const { created, item } = await this.service.add(userActor(req).userId, body);
    sendOk(res, item, created ? 201 : 200);
  };

  update: RequestHandler = async (req, res) => {
    const { params, body } = validated<UpdateCartItemBody, unknown, IdParams>(req);
    sendOk(res, await this.service.updateParticipants(userActor(req).userId, params.id, body));
  };

  remove: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, IdParams>(req);
    await this.service.remove(userActor(req).userId, params.id);
    sendNoContent(res);
  };
}

export const cartsController = new CartsController();
