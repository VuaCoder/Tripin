import { Router } from 'express';
import { PERMISSIONS } from '@travel-platform/constants';
import { requirePermission } from '../../middlewares/authorize';
import { createRateLimiter } from '../../middlewares/rate-limit';
import { validate } from '../../middlewares/validate';
import { chatController } from './chat.controller';
import {
  conversationIdParams,
  listConversationsQuery,
  listMessagesQuery,
  sendMessageBody,
  startConversationBody,
} from './chat.validation';

const messageLimiter = createRateLimiter({ windowMs: 60 * 1000, limit: 60 });

/** Mounted at /api/v1/chat — REST side of the traveler <-> tour guide conversation (realtime: chat.gateway.ts). */
export const chatRouter = Router();
chatRouter.use(requirePermission(PERMISSIONS.CHAT_USE));
chatRouter.post('/conversations', validate({ body: startConversationBody }), chatController.start);
chatRouter.get('/conversations', validate({ query: listConversationsQuery }), chatController.list);
chatRouter.get('/conversations/:id/messages', validate({ params: conversationIdParams, query: listMessagesQuery }), chatController.messages);
chatRouter.post('/conversations/:id/messages', messageLimiter, validate({ params: conversationIdParams, body: sendMessageBody }), chatController.send);
chatRouter.post('/conversations/:id/read', validate({ params: conversationIdParams }), chatController.read);
