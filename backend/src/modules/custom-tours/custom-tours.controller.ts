import type { RequestHandler } from 'express';
import { userActor } from '../../middlewares/authorize';
import { validated } from '../../middlewares/validate';
import { sendOk, sendPaginated } from '../../utils/api-response';
import type { IdParams } from '../../utils/id';
import { customToursService, type CustomToursService } from './custom-tours.service';
import type {
  AcceptCustomTourOfferBody,
  CreateCustomTourBody,
  CreateCustomTourBookingBody,
  DecideCustomTourBody,
  ListCustomToursQueryInput,
  SaveCustomTourCheckoutBody,
  SaveCustomTourDraftBody,
  SendCustomTourOfferBody,
} from './custom-tours.validation';

/** HTTP only. The traveler/agency identity is always the logged-in actor, never a client-supplied id. */
export class CustomToursController {
  constructor(private readonly service: CustomToursService = customToursService) {}

  create: RequestHandler = async (req, res) => {
    const { body } = validated<CreateCustomTourBody>(req);
    sendOk(res, await this.service.create(userActor(req).userId, body), 201);
  };

  list: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, ListCustomToursQueryInput>(req);
    const page = await this.service.list(userActor(req), query);
    sendPaginated(res, page.items, page.meta);
  };

  get: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, IdParams>(req);
    sendOk(res, await this.service.get(userActor(req), params.id));
  };

  decide: RequestHandler = async (req, res) => {
    const { params, body } = validated<DecideCustomTourBody, unknown, IdParams>(req);
    sendOk(res, await this.service.decide(userActor(req), params.id, body.decision));
  };

  saveDraft: RequestHandler = async (req, res) => {
    const { params, body } = validated<SaveCustomTourDraftBody, unknown, IdParams>(req);
    sendOk(res, await this.service.saveDraft(userActor(req), params.id, body));
  };

  sendOffer: RequestHandler = async (req, res) => {
    const { params, body } = validated<SendCustomTourOfferBody, unknown, IdParams>(req);
    sendOk(res, await this.service.sendOffer(userActor(req), params.id, body.revision));
  };

  acceptOffer: RequestHandler = async (req, res) => {
    const { params, body } = validated<AcceptCustomTourOfferBody, unknown, IdParams>(req);
    sendOk(res, await this.service.acceptOffer(userActor(req), params.id, body.revision));
  };

  saveCheckoutDraft: RequestHandler = async (req, res) => {
    const { params, body } = validated<SaveCustomTourCheckoutBody, unknown, IdParams>(req);
    sendOk(res, await this.service.saveCheckoutDraft(userActor(req), params.id, body));
  };

  /** 201 for a new booking, 200 when the request already had one (a retry or a second tab). */
  createBooking: RequestHandler = async (req, res) => {
    const { params, body } = validated<CreateCustomTourBookingBody, unknown, IdParams>(req);
    const { booking, created } = await this.service.createBooking(userActor(req), params.id, body.clientRequestId);
    sendOk(res, booking, created ? 201 : 200);
  };
}

export const customToursController = new CustomToursController();
