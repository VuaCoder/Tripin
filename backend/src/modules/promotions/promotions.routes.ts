import { Router } from 'express';
import { PERMISSIONS } from '@travel-platform/constants';
import { requirePermission } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { promotionsController } from './promotions.controller';
import {
  createPromotionBody,
  listPromotionsQuery,
  previewQuery,
  promotionIdParams,
  updatePromotionBody,
} from './promotions.validation';

/** Mounted at /api/v1/agency/promotions — the logged-in agency's promotions. */
export const agencyPromotionsRouter = Router();
agencyPromotionsRouter.use(requirePermission(PERMISSIONS.PROMOTION_AGENCY_MANAGE));
agencyPromotionsRouter.get('/', validate({ query: listPromotionsQuery }), promotionsController.listAgency);
agencyPromotionsRouter.post('/', validate({ body: createPromotionBody }), promotionsController.createAgency);
agencyPromotionsRouter.get('/:id', validate({ params: promotionIdParams }), promotionsController.getAgency);
agencyPromotionsRouter.patch(
  '/:id',
  validate({ params: promotionIdParams, body: updatePromotionBody }),
  promotionsController.updateAgency,
);

/** Mounted at /api/v1/admin/promotions — SUPER_ADMIN platform promotions. */
export const adminPromotionsRouter = Router();
adminPromotionsRouter.use(requirePermission(PERMISSIONS.PROMOTION_PLATFORM_MANAGE));
adminPromotionsRouter.get('/', validate({ query: listPromotionsQuery }), promotionsController.listPlatform);
adminPromotionsRouter.post('/', validate({ body: createPromotionBody }), promotionsController.createPlatform);
adminPromotionsRouter.get('/:id', validate({ params: promotionIdParams }), promotionsController.getPlatform);
adminPromotionsRouter.patch(
  '/:id',
  validate({ params: promotionIdParams, body: updatePromotionBody }),
  promotionsController.updatePlatform,
);

/** Mounted at /api/v1/promotions — checkout helper for travelers. */
export const promotionsRouter = Router();
promotionsRouter.get('/preview', requirePermission(PERMISSIONS.BOOKING_CREATE), validate({ query: previewQuery }), promotionsController.preview);
