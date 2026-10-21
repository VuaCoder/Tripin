import { randomUUID } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import type { TourStatus } from '@travel-platform/constants';
import { uploadImageBuffer } from '../../integrations/cloudinary';
import { userActor } from '../../middlewares/authorize';
import { validated } from '../../middlewares/validate';
import { sendCreated, sendNoContent, sendOk, sendPaginated } from '../../utils/api-response';
import { AppError } from '../../utils/app-error';
import type { IdParams } from '../../utils/id';
import { pageQueryOf } from './tours.query';
import { toursDiscoveryService, type ToursDiscoveryService } from './tours-discovery.service';
import { toursService, type ToursService } from './tours.service';
import type {
  AgencyToursQueryInput,
  AssignGuideBody,
  AvailabilityBody,
  CreateTourBody,
  GuideVerificationBody,
  ImportToursBody,
  ItineraryBody,
  SearchToursQueryInput,
  UpdateTourBody,
} from './tours.validation';

const agencyIdOf = (req: Request) => userActor(req).userId;

/** HTTP only. Three routers (public, agency, guide) share this controller; rules live in the services. */
export class ToursController {
  constructor(
    private readonly service: ToursService = toursService,
    private readonly discovery: ToursDiscoveryService = toursDiscoveryService,
  ) {}

  // ---- public
  search: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, SearchToursQueryInput>(req);
    const page = await this.discovery.search(query);
    sendPaginated(res, page.items, page.meta);
  };

  detail: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, IdParams>(req);
    sendOk(res, await this.discovery.getDetail(params.id, req.actor));
  };

  getDestinations: RequestHandler = async (_req, res) => {
    sendOk(res, await this.discovery.getDestinations());
  };

  // ---- agency
  createCategory: RequestHandler = async (req, res) => {
    const { body } = validated<{ name: string }>(req);
    sendCreated(res, await this.service.createCategory(body.name));
  };

  create: RequestHandler = async (req, res) => {
    const { body } = validated<CreateTourBody>(req);
    sendCreated(res, await this.service.createTour(agencyIdOf(req), body));
  };

  uploadImage: RequestHandler = async (req, res) => {
    const file = req.file;
    if (!file) throw AppError.badRequest('Vui lòng chọn file ảnh');
    const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowedMime.has(file.mimetype)) {
      throw AppError.badRequest('Chỉ hỗ trợ file ảnh định dạng JPG, PNG hoặc WebP');
    }
    const agencyId = agencyIdOf(req);
    const identifier = `${agencyId}/${Date.now()}_${randomUUID()}`;
    const result = await uploadImageBuffer('tourImage', identifier, file.buffer, file.mimetype);
    sendOk(res, { url: result.secureUrl, publicId: result.publicId });
  };

  importTours: RequestHandler = async (req, res) => {
    const { body } = validated<ImportToursBody>(req);
    sendCreated(res, await this.service.importTours(agencyIdOf(req), body.tours));
  };

  listOwn: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, AgencyToursQueryInput>(req);
    const page = await this.service.listOwn(agencyIdOf(req), { ...pageQueryOf(query), status: query.status as TourStatus | undefined, q: query.q });
    sendPaginated(res, page.items, page.meta);
  };

  getOwn: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, IdParams>(req);
    sendOk(res, await this.service.getOwn(agencyIdOf(req), params.id));
  };

  update: RequestHandler = async (req, res) => {
    const { params, body } = validated<UpdateTourBody, unknown, IdParams>(req);
    sendOk(res, await this.service.updateTour(agencyIdOf(req), params.id, body));
  };

  remove: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, IdParams>(req);
    await this.service.deleteTour(agencyIdOf(req), params.id);
    sendNoContent(res);
  };

  restore: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, IdParams>(req);
    sendOk(res, await this.service.restoreTour(agencyIdOf(req), params.id));
  };

  setAvailability: RequestHandler = async (req, res) => {
    const { params, body } = validated<AvailabilityBody, unknown, IdParams>(req);
    sendOk(res, await this.service.setAvailability(agencyIdOf(req), params.id, body.departures));
  };

  setItinerary: RequestHandler = async (req, res) => {
    const { params, body } = validated<ItineraryBody, unknown, IdParams>(req);
    sendOk(res, await this.service.setItinerary(agencyIdOf(req), params.id, body.days));
  };

  assignGuide: RequestHandler = async (req, res) => {
    const { params, body } = validated<AssignGuideBody, unknown, IdParams>(req);
    sendOk(res, await this.service.assignGuide(agencyIdOf(req), params.id, body));
  };

  submit: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, IdParams>(req);
    sendOk(res, await this.service.submitForReview(agencyIdOf(req), params.id), 202);
  };

  // ---- guide
  listAssigned: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, AgencyToursQueryInput>(req);
    const page = await this.service.listAssigned(userActor(req).userId, pageQueryOf(query));
    sendPaginated(res, page.items, page.meta);
  };

  answerAssignment: RequestHandler = async (req, res) => {
    const { params, body } = validated<GuideVerificationBody, unknown, { tourId: string }>(req);
    sendOk(res, await this.service.answerAssignment(userActor(req).userId, params.tourId, body));
  };
}

export const toursController = new ToursController();
