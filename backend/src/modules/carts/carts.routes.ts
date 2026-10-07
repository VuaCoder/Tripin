import { Router } from 'express';
import { PERMISSIONS } from '@travel-platform/constants';
import { requirePermission } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { cartsController } from './carts.controller';
import { addCartItemBody, cartItemParams, updateCartItemBody } from './carts.validation';

/** Mounted at /api/v1/cart — the logged-in traveler's shortlist of tour departures to book. */
export const cartsRouter = Router();
cartsRouter.use(requirePermission(PERMISSIONS.CART_MANAGE));
cartsRouter.get('/', cartsController.get);
cartsRouter.post('/items', validate({ body: addCartItemBody }), cartsController.add);
cartsRouter.patch('/items/:id', validate({ params: cartItemParams, body: updateCartItemBody }), cartsController.update);
cartsRouter.delete('/items/:id', validate({ params: cartItemParams }), cartsController.remove);
