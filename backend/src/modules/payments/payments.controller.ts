import type { RequestHandler } from 'express';
import { userActor } from '../../middlewares/authorize';
import { validated } from '../../middlewares/validate';
import { sendCreated, sendOk } from '../../utils/api-response';
import type { IdParams } from '../../utils/id';
import { paymentsService, type PaymentsService } from './payments.service';
import type { BookingParams } from './payments.validation';

/** HTTP only. The payer is always the authenticated user; amounts never come from the request. */
export class PaymentsController {
  constructor(private readonly service: PaymentsService = paymentsService) {}

  checkoutBooking: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, BookingParams>(req);
    sendCreated(res, await this.service.createBookingCheckout(userActor(req).userId, params.bookingId));
  };

  getMine: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, IdParams>(req);
    sendOk(res, await this.service.getMine(userActor(req).userId, params.id));
  };

  /** Public endpoint called by PayOS. Trust comes from the signature, checked in the provider. */
  payosWebhook: RequestHandler = async (req, res) => {
    await this.service.handleWebhook(req.body);
    // Always 200 for a correctly signed call (including unknown/duplicate orders) so the gateway stops retrying.
    res.status(200).json({ success: true });
  };
}

export const paymentsController = new PaymentsController();
