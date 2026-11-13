import { Router } from 'express';
import { PERMISSIONS } from '@travel-platform/constants';
import { requirePermission } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { customToursController } from './custom-tours.controller';
import { acceptCustomTourOfferBody, createCustomTourBody, createCustomTourBookingBody, customTourParams, decideCustomTourBody, listCustomToursQuery, saveCustomTourCheckoutBody, saveCustomTourDraftBody, sendCustomTourOfferBody } from './custom-tours.validation';

/** Mounted at /api/v1/custom-tours — group-booking requests (traveler creates, both sides read and answer). */
export const customToursRouter = Router();
customToursRouter.post('/', requirePermission(PERMISSIONS.CUSTOM_TOUR_REQUEST), validate({ body: createCustomTourBody }), customToursController.create);
customToursRouter.get('/', requirePermission(PERMISSIONS.CUSTOM_TOUR_VIEW), validate({ query: listCustomToursQuery }), customToursController.list);
customToursRouter.get('/:id', requirePermission(PERMISSIONS.CUSTOM_TOUR_VIEW), validate({ params: customTourParams }), customToursController.get);
customToursRouter.patch(
  '/:id/decision',
  requirePermission(PERMISSIONS.CUSTOM_TOUR_RESPOND),
  validate({ params: customTourParams, body: decideCustomTourBody }),
  customToursController.decide,
);
customToursRouter.patch(
  '/:id/draft',
  requirePermission(PERMISSIONS.CUSTOM_TOUR_RESPOND),
  validate({ params: customTourParams, body: saveCustomTourDraftBody }),
  customToursController.saveDraft,
);
customToursRouter.post(
  '/:id/offers',
  requirePermission(PERMISSIONS.CUSTOM_TOUR_RESPOND),
  validate({ params: customTourParams, body: sendCustomTourOfferBody }),
  customToursController.sendOffer,
);
customToursRouter.post(
  '/:id/acceptance',
  requirePermission(PERMISSIONS.CUSTOM_TOUR_REQUEST),
  validate({ params: customTourParams, body: acceptCustomTourOfferBody }),
  customToursController.acceptOffer,
);
// The resumable passenger form, after the offer is accepted.
customToursRouter.patch(
  '/:id/checkout-draft',
  requirePermission(PERMISSIONS.CUSTOM_TOUR_REQUEST),
  validate({ params: customTourParams, body: saveCustomTourCheckoutBody }),
  customToursController.saveCheckoutDraft,
);
// Turns the accepted offer plus that form into the one live booking of the request.
customToursRouter.post(
  '/:id/bookings',
  requirePermission(PERMISSIONS.CUSTOM_TOUR_REQUEST),
  validate({ params: customTourParams, body: createCustomTourBookingBody }),
  customToursController.createBooking,
);
