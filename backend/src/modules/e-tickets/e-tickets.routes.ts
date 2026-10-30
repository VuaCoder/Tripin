import { Router } from 'express';
import { PERMISSIONS } from '@travel-platform/constants';
import { requirePermission } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { eTicketsController } from './e-tickets.controller';
import { bookingParams, eTicketIdParams, guideCheckInBody, guideTourParams, listETicketsQuery } from './e-tickets.validation';

/** Mounted at /api/v1/e-tickets — the logged-in traveler's tickets. */
export const eTicketsRouter = Router();
eTicketsRouter.use(requirePermission(PERMISSIONS.ETICKET_VIEW_OWN));
eTicketsRouter.get('/', validate({ query: listETicketsQuery }), eTicketsController.list);
// Declared before '/:id' so "booking" is not read as an id.
eTicketsRouter.get('/booking/:bookingId', validate({ params: bookingParams }), eTicketsController.getByBooking);
eTicketsRouter.get('/:id', validate({ params: eTicketIdParams }), eTicketsController.get);

/** Mounted at /api/v1/guide/e-tickets — the tour guide's roster and QR check-in. */
export const guideETicketsRouter = Router();
guideETicketsRouter.use(requirePermission(PERMISSIONS.GUIDE_CHECK_IN));
guideETicketsRouter.get('/:tourId', validate({ params: guideTourParams }), eTicketsController.rosterForGuide);
guideETicketsRouter.post(
  '/:tourId/check-in',
  validate({ params: guideTourParams, body: guideCheckInBody }),
  eTicketsController.checkInForGuide,
);
