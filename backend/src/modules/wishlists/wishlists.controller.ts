import type { RequestHandler } from 'express';
import { userActor } from '../../middlewares/authorize';
import { validated } from '../../middlewares/validate';
import { sendNoContent, sendOk, sendPaginated } from '../../utils/api-response';
import { wishlistsService, type WishlistsService } from './wishlists.service';
import type { ListWishlistQueryInput, WishlistTourParams } from './wishlists.validation';

/** HTTP only. The wishlist owner is ALWAYS the logged-in user; no user id is accepted from the client. */
export class WishlistsController {
  constructor(private readonly service: WishlistsService = wishlistsService) {}

  list: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, ListWishlistQueryInput>(req);
    const page = await this.service.list(userActor(req).userId, query);
    sendPaginated(res, page.items, page.meta);
  };

  add: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, WishlistTourParams>(req);
    const result = await this.service.add(userActor(req).userId, params.tourId);
    sendOk(res, { tourId: params.tourId, saved: true }, result.created ? 201 : 200);
  };

  remove: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, WishlistTourParams>(req);
    await this.service.remove(userActor(req).userId, params.tourId);
    sendNoContent(res);
  };
}

export const wishlistsController = new WishlistsController();
