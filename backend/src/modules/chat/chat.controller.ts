import type { RequestHandler } from 'express';
import { userActor } from '../../middlewares/authorize';
import { validated } from '../../middlewares/validate';
import { sendCreated, sendOk, sendPaginated } from '../../utils/api-response';
import type { IdParams } from '../../utils/id';
import { chatService, type ChatService } from './chat.service';
import type {
  ListConversationsQueryInput,
  ListMessagesQueryInput,
  SendMessageBody,
  StartConversationBody,
} from './chat.validation';

/** HTTP only. The sender is always the authenticated user. */
export class ChatController {
  constructor(private readonly service: ChatService = chatService) {}

  start: RequestHandler = async (req, res) => {
    const { body } = validated<StartConversationBody>(req);
    const actor = userActor(req);
    sendOk(res, await this.service.startConversation({ userId: actor.userId, role: actor.role }, body));
  };

  list: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, ListConversationsQueryInput>(req);
    const actor = userActor(req);
    const page = await this.service.listConversations({ userId: actor.userId, role: actor.role }, query);
    sendPaginated(res, page.items, page.meta);
  };

  messages: RequestHandler = async (req, res) => {
    const { params, query } = validated<unknown, ListMessagesQueryInput, IdParams>(req);
    sendOk(res, await this.service.listMessages(userActor(req).userId, params.id, query));
  };

  send: RequestHandler = async (req, res) => {
    const { params, body } = validated<SendMessageBody, unknown, IdParams>(req);
    sendCreated(res, await this.service.sendMessage(userActor(req).userId, params.id, body.text));
  };

  read: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, IdParams>(req);
    sendOk(res, await this.service.markRead(userActor(req).userId, params.id));
  };
}

export const chatController = new ChatController();
