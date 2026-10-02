import type { RequestHandler } from 'express';
import { userActor } from '../../middlewares/authorize';
import { validated } from '../../middlewares/validate';
import { sendOk, sendPaginated } from '../../utils/api-response';
import type { IdParams } from '../../utils/object-id';
import { eTicketsService, type ETicketsService } from './e-tickets.service';
import type { BookingParams, ListETicketsQueryInput } from './e-tickets.validation';

/** HTTP only. Tickets are always looked up for the authenticated traveler. */
export class ETicketsController {
  constructor(private readonly service: ETicketsService = eTicketsService) {}

  list: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, ListETicketsQueryInput>(req);
    const page = await this.service.listMine(userActor(req).userId, query);
    sendPaginated(res, page.items, page.meta);
  };

  get: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, IdParams>(req);
    sendOk(res, await this.service.getMine(userActor(req).userId, params.id));
  };

  getByBooking: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, BookingParams>(req);
    sendOk(res, await this.service.getMineByBooking(userActor(req).userId, params.bookingId));
  };
}

export const eTicketsController = new ETicketsController();
