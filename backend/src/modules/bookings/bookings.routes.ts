import { Router } from 'express';
import { PERMISSIONS } from '@travel-platform/constants';
import { requirePermission } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { bookingsController } from './bookings.controller';
import {
  bookingIdParams,
  cancelBookingBody,
  createBookingBody,
  customersExportQuery,
  listAgencyBookingsQuery,
  listBookingsQuery,
} from './bookings.validation';

const P = PERMISSIONS;

/** Mounted at /api/v1/bookings — the logged-in traveler's bookings. */
export const bookingsRouter = Router();
bookingsRouter.post('/', requirePermission(P.BOOKING_CREATE), validate({ body: createBookingBody }), bookingsController.create);
// '/me' must be declared before '/:id'.
bookingsRouter.get('/me', requirePermission(P.BOOKING_VIEW_OWN), validate({ query: listBookingsQuery }), bookingsController.listMine);
bookingsRouter.get('/:id', requirePermission(P.BOOKING_VIEW_OWN), validate({ params: bookingIdParams }), bookingsController.getMine);
bookingsRouter.post(
  '/:id/cancel',
  requirePermission(P.BOOKING_VIEW_OWN),
  validate({ params: bookingIdParams, body: cancelBookingBody }),
  bookingsController.cancelMine,
);

/** Mounted at /api/v1/agency/bookings — bookings of the logged-in agency's tours. */
export const agencyBookingsRouter = Router();
agencyBookingsRouter.use(requirePermission(P.AGENCY_BOOKINGS_VIEW));
agencyBookingsRouter.get('/', validate({ query: listAgencyBookingsQuery }), bookingsController.listForAgency);
agencyBookingsRouter.get('/:id', validate({ params: bookingIdParams }), bookingsController.getForAgency);

/** Mounted at /api/v1/agency/tours — "Export customer PDF" (the rest of /agency/tours belongs to the tours module). */
export const agencyCustomersExportRouter = Router();
agencyCustomersExportRouter.get(
  '/:id/customers.pdf',
  requirePermission(P.AGENCY_EXPORT_CUSTOMERS),
  validate({ params: bookingIdParams, query: customersExportQuery }),
  bookingsController.exportCustomers,
);
