import type { RequestHandler } from 'express';
import { userActor } from '../../middlewares/authorize';
import { validated } from '../../middlewares/validate';
import { sendCreated, sendOk, sendPaginated } from '../../utils/api-response';
import type { IdParams } from '../../utils/object-id';
import { supportService, type SupportService } from './support.service';
import type { TicketCategory, TicketStatus } from './support.types';
import type { CreateTicketBody, ListTicketsQueryInput, ReplyBody } from './support.validation';

/** HTTP only. A ticket always belongs to the authenticated user. */
export class SupportController {
  constructor(private readonly service: SupportService = supportService) {}

  create: RequestHandler = async (req, res) => {
    const { body } = validated<CreateTicketBody>(req);
    sendCreated(res, await this.service.createTicket(userActor(req).userId, { ...body, category: body.category as TicketCategory }));
  };

  listMine: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, ListTicketsQueryInput>(req);
    const page = await this.service.listMine(userActor(req).userId, { ...query, status: query.status as TicketStatus | undefined });
    sendPaginated(res, page.items, page.meta);
  };

  getMine: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, IdParams>(req);
    sendOk(res, await this.service.getMine(userActor(req).userId, params.id));
  };

  reply: RequestHandler = async (req, res) => {
    const { params, body } = validated<ReplyBody, unknown, IdParams>(req);
    sendCreated(res, await this.service.replyAsOwner(userActor(req).userId, params.id, body.text));
  };

  close: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, IdParams>(req);
    sendOk(res, await this.service.closeMine(userActor(req).userId, params.id));
  };
}

export const supportController = new SupportController();
