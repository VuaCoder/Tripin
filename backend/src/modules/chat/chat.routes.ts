import { Router } from 'express';
import multer from 'multer';
import { PERMISSIONS } from '@travel-platform/constants';
import { requirePermission } from '../../middlewares/authorize';
import { requireAgencyPermission } from '../../middlewares/agency-context';
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
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });

/** Same handlers under both prefixes; route introspection only sees routes declared on the mounted router itself. */
const registerConversationRoutes = (router: Router) => {
  router.post('/upload-image', upload.single('file'), chatController.uploadImage);
  router.post('/conversations', validate({ body: startConversationBody }), chatController.start);
  router.get('/conversations', validate({ query: listConversationsQuery }), chatController.list);
  router.get('/conversations/:id', validate({ params: conversationIdParams }), chatController.detail);
  router.get('/conversations/:id/messages', validate({ params: conversationIdParams, query: listMessagesQuery }), chatController.messages);
  router.post('/conversations/:id/messages', messageLimiter, validate({ params: conversationIdParams, body: sendMessageBody }), chatController.send);
  router.post('/conversations/:id/read', validate({ params: conversationIdParams }), chatController.read);
};

/** Mounted at /api/v1/chat — REST side of the traveler <-> tour guide conversation (realtime: chat.gateway.ts). */
export const chatRouter = Router();
chatRouter.use(requirePermission(PERMISSIONS.CHAT_USE));
registerConversationRoutes(chatRouter);

/** Mounted at /api/v1/agency/chat: the same endpoints, scoped to the selected agency. */
export const agencyChatRouter = Router();
agencyChatRouter.use(requireAgencyPermission(PERMISSIONS.CHAT_USE));
registerConversationRoutes(agencyChatRouter);
