import { Router } from 'express';
import { PERMISSIONS } from '@travel-platform/constants';
import { requirePermission } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { wishlistsController } from './wishlists.controller';
import { listWishlistQuery, wishlistTourParams } from './wishlists.validation';

/** Mounted at /api/v1/wishlist — the logged-in traveler's saved tours. */
export const wishlistsRouter = Router();
wishlistsRouter.use(requirePermission(PERMISSIONS.WISHLIST_MANAGE));
wishlistsRouter.get('/', validate({ query: listWishlistQuery }), wishlistsController.list);
wishlistsRouter.post('/:tourId', validate({ params: wishlistTourParams }), wishlistsController.add);
wishlistsRouter.delete('/:tourId', validate({ params: wishlistTourParams }), wishlistsController.remove);
