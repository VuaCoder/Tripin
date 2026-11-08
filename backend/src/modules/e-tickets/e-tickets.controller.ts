import type { RequestHandler } from 'express';
import { userActor } from '../../middlewares/authorize';
import { validated } from '../../middlewares/validate';
import { sendOk, sendPaginated } from '../../utils/api-response';
import type { IdParams } from '../../utils/id';
import { eTicketsService, type ETicketsService } from './e-tickets.service';
import type { BookingParams, GuideCheckInBodyInput, GuideTourParams, ListETicketsQueryInput } from './e-tickets.validation';

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

  // ---- guide
  scan: RequestHandler = async (req, res) => {
    const { body } = validated<{ tourId: string; departureId?: string; code: string }>(req);
    sendOk(res, await this.service.checkInForGuide(userActor(req).userId, body.tourId, body.code, body.departureId));
  };

  rosterForGuide: RequestHandler = async (req, res) => {
    const { params, query } = validated<unknown, { departureId?: string }, GuideTourParams>(req);
    sendOk(res, await this.service.rosterForGuide(userActor(req).userId, params.tourId, query.departureId));
  };

  checkInForGuide: RequestHandler = async (req, res) => {
    const { body, params } = validated<GuideCheckInBodyInput, unknown, GuideTourParams>(req);
    sendOk(res, await this.service.checkInForGuide(userActor(req).userId, params.tourId, body.code, body.departureId));
  };

  completeTripForGuide: RequestHandler = async (req, res) => {
    const { params, body } = validated<{ departureId?: string }, unknown, GuideTourParams>(req);
    sendOk(res, await this.service.completeTripForGuide(userActor(req).userId, params.tourId, body.departureId));
  };
}

export const eTicketsController = new ETicketsController();
