import { Router } from 'express';
import { PERMISSIONS } from '@travel-platform/constants';
import { requireAuth, requirePermission } from '../../middlewares/authorize';
import { createRateLimiter } from '../../middlewares/rate-limit';
import { validate } from '../../middlewares/validate';
import { paymentsController } from './payments.controller';
import { bookingParams, paymentIdParams } from './payments.validation';

const webhookLimiter = createRateLimiter({ windowMs: 60 * 1000, limit: 120 });

/** Mounted at /api/v1/payments */
export const paymentsRouter = Router();

// Public: authenticated by the gateway signature, not by a session.
paymentsRouter.post('/webhooks/payos', webhookLimiter, paymentsController.payosWebhook);

paymentsRouter.post(
  '/bookings/:bookingId/checkout',
  requirePermission(PERMISSIONS.PAYMENT_CREATE),
  validate({ params: bookingParams }),
  paymentsController.checkoutBooking,
);
paymentsRouter.get('/:id', requireAuth, validate({ params: paymentIdParams }), paymentsController.getMine);
