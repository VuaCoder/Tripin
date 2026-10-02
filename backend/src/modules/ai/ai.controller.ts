import type { RequestHandler } from 'express';
import { userActor } from '../../middlewares/authorize';
import { validated } from '../../middlewares/validate';
import { sendOk, sendPaginated } from '../../utils/api-response';
import type { IdParams } from '../../utils/id';
import { aiService, type AiService } from './ai.service';
import type { ChatBody, ListAiConversationsQueryInput } from './ai.validation';

/** HTTP only. Conversations are always scoped to the authenticated user. */
export class AiController {
  constructor(private readonly service: AiService = aiService) {}

  chat: RequestHandler = async (req, res) => {
    const { body } = validated<ChatBody>(req);
    sendOk(res, await this.service.chat(userActor(req).userId, body));
  };

  list: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, ListAiConversationsQueryInput>(req);
    const page = await this.service.listMine(userActor(req).userId, query);
    sendPaginated(res, page.items, page.meta);
  };

  get: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, IdParams>(req);
    sendOk(res, await this.service.getMine(userActor(req).userId, params.id));
  };
}

export const aiController = new AiController();
