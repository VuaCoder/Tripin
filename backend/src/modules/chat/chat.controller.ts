import type { RequestHandler } from 'express';
import { AppError } from '../../utils/app-error';
import { uploadImageBuffer } from '../../integrations/cloudinary';
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

  uploadImage: RequestHandler = async (req, res) => {
    const file = req.file;
    if (!file) throw AppError.badRequest('Vui lòng chọn file ảnh');
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowed.has(file.mimetype)) throw AppError.badRequest('Chỉ hỗ trợ file ảnh định dạng JPG, PNG hoặc WebP');
    if (file.size > 5 * 1024 * 1024) throw AppError.badRequest('Kích thước ảnh tối đa là 5 MB');
    const actor = userActor(req);
    const identifier = `${actor.userId}_${Date.now()}`;
    const result = await uploadImageBuffer('tourImage', identifier, file.buffer, file.mimetype);
    sendOk(res, { url: result.secureUrl, publicId: result.publicId });
  };

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

  detail: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, IdParams>(req);
    sendOk(res, await this.service.getConversation(userActor(req).userId, params.id));
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
