import { Router } from 'express';
import { PERMISSIONS } from '@travel-platform/constants';
import { requirePermission } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { subscriptionsController } from './subscriptions.controller';
import { listMySubscriptionsQuery, subscribeBody } from './subscriptions.validation';

const subscribe = PERMISSIONS.SUBSCRIPTION_SUBSCRIBE;

/** Mounted at /api/v1/subscriptions */
export const subscriptionsRouter = Router();
subscriptionsRouter.get('/plans', subscriptionsController.listPlans); // public
subscriptionsRouter.post('/', requirePermission(subscribe), validate({ body: subscribeBody }), subscriptionsController.subscribe);
subscriptionsRouter.get('/me', requirePermission(subscribe), validate({ query: listMySubscriptionsQuery }), subscriptionsController.listMine);
subscriptionsRouter.get('/me/current', requirePermission(subscribe), subscriptionsController.current);
