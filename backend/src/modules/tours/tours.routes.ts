import { Router } from 'express';
import { PERMISSIONS } from '@travel-platform/constants';
import { requirePermission } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { toursController } from './tours.controller';
import {
  agencyToursQuery,
  assignGuideBody,
  availabilityBody,
  createTourBody,
  guideTourParams,
  guideVerificationBody,
  importToursBody,
  itineraryBody,
  searchToursQuery,
  tourIdParams,
  updateTourBody,
} from './tours.validation';

const P = PERMISSIONS;

/** Mounted at /api/v1/tours — public discovery (GUEST allowed). */
export const publicToursRouter = Router();
publicToursRouter.get('/', validate({ query: searchToursQuery }), toursController.search);
publicToursRouter.get('/:id', validate({ params: tourIdParams }), toursController.detail);

/** Mounted at /api/v1/agency/tours — the logged-in agency's own tours. */
export const agencyToursRouter = Router();
agencyToursRouter.get('/', requirePermission(P.TOUR_UPDATE_OWN), validate({ query: agencyToursQuery }), toursController.listOwn);
agencyToursRouter.post('/', requirePermission(P.TOUR_CREATE), validate({ body: createTourBody }), toursController.create);
// Declared before '/:id' routes so "import" is not read as an id.
agencyToursRouter.post('/import', requirePermission(P.TOUR_IMPORT), validate({ body: importToursBody }), toursController.importTours);
agencyToursRouter.get('/:id', requirePermission(P.TOUR_UPDATE_OWN), validate({ params: tourIdParams }), toursController.getOwn);
agencyToursRouter.patch(
  '/:id',
  requirePermission(P.TOUR_UPDATE_OWN),
  validate({ params: tourIdParams, body: updateTourBody }),
  toursController.update,
);
agencyToursRouter.delete('/:id', requirePermission(P.TOUR_DELETE_OWN), validate({ params: tourIdParams }), toursController.remove);
agencyToursRouter.put(
  '/:id/availability',
  requirePermission(P.TOUR_SET_AVAILABILITY),
  validate({ params: tourIdParams, body: availabilityBody }),
  toursController.setAvailability,
);
agencyToursRouter.put(
  '/:id/itinerary',
  requirePermission(P.TOUR_CONFIGURE_ITINERARY),
  validate({ params: tourIdParams, body: itineraryBody }),
  toursController.setItinerary,
);
agencyToursRouter.put(
  '/:id/guide',
  requirePermission(P.TOUR_ASSIGN_GUIDE),
  validate({ params: tourIdParams, body: assignGuideBody }),
  toursController.assignGuide,
);
agencyToursRouter.post('/:id/submit', requirePermission(P.TOUR_UPDATE_OWN), validate({ params: tourIdParams }), toursController.submit);

/** Mounted at /api/v1/guide/tours — tours assigned to the logged-in tour guide. */
export const guideToursRouter = Router();
guideToursRouter.get('/', requirePermission(P.GUIDE_TOURS_VIEW), validate({ query: agencyToursQuery }), toursController.listAssigned);
guideToursRouter.post(
  '/:tourId/verification',
  requirePermission(P.GUIDE_TOURS_VERIFY),
  validate({ params: guideTourParams, body: guideVerificationBody }),
  toursController.answerAssignment,
);
