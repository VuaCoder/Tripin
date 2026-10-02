import type { RequestHandler } from 'express';
import type { BookingStatus } from '@travel-platform/constants';
import { userActor } from '../../middlewares/authorize';
import { validated } from '../../middlewares/validate';
import { sendCreated, sendOk, sendPaginated } from '../../utils/api-response';
import type { IdParams } from '../../utils/object-id';
import { renderCustomersPdf } from './bookings.export';
import { bookingsService, type BookingsService } from './bookings.service';
import type {
  CancelBookingBody,
  CreateBookingBody,
  ListAgencyBookingsQueryInput,
  ListBookingsQueryInput,
  CustomersExportQueryInput,
} from './bookings.validation';

/** HTTP only. The booking owner / agency is always the authenticated user, never a value from the client. */
export class BookingsController {
  constructor(private readonly service: BookingsService = bookingsService) {}

  create: RequestHandler = async (req, res) => {
    const { body } = validated<CreateBookingBody>(req);
    sendCreated(res, await this.service.createBooking(userActor(req).userId, body));
  };

  listMine: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, ListBookingsQueryInput>(req);
    const page = await this.service.listMine(userActor(req).userId, { ...query, status: query.status as BookingStatus | undefined });
    sendPaginated(res, page.items, page.meta);
  };

  getMine: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, IdParams>(req);
    sendOk(res, await this.service.getMine(userActor(req).userId, params.id));
  };

  cancelMine: RequestHandler = async (req, res) => {
    const { params, body } = validated<CancelBookingBody, unknown, IdParams>(req);
    sendOk(res, await this.service.cancelMine(userActor(req).userId, params.id, body.reason));
  };

  listForAgency: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, ListAgencyBookingsQueryInput>(req);
    const page = await this.service.listForAgency(userActor(req).userId, { ...query, status: query.status as BookingStatus | undefined });
    sendPaginated(res, page.items, page.meta);
  };

  getForAgency: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, IdParams>(req);
    sendOk(res, await this.service.getForAgency(userActor(req).userId, params.id));
  };

  /** Streams the PDF customer list of one of the agency's tours. */
  exportCustomers: RequestHandler = async (req, res) => {
    const { params, query } = validated<unknown, CustomersExportQueryInput, IdParams>(req);
    const { tourTitle, rows, truncated } = await this.service.listCustomers(userActor(req).userId, params.id, query.departureId);
    const doc = renderCustomersPdf({ tourTitle, rows, truncated, generatedAt: new Date() });
    res.status(200);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="customers-${params.id}.pdf"`);
    res.setHeader('Cache-Control', 'no-store');
    doc.on('error', () => res.destroy());
    doc.pipe(res);
    doc.end();
  };
}

export const bookingsController = new BookingsController();
