import { Router } from 'express';
import { PERMISSIONS } from '@travel-platform/constants';
import { requirePermission } from '../../middlewares/authorize';
import { createRateLimiter } from '../../middlewares/rate-limit';
import { validate } from '../../middlewares/validate';
import { aiController } from './ai.controller';
import { aiConversationParams, chatBody, listAiConversationsQuery } from './ai.validation';

// Every call costs money at the model vendor: keep it modest per IP.
const chatLimiter = createRateLimiter({ windowMs: 60 * 1000, limit: 15 });

/** Mounted at /api/v1/ai — the Traveler's assistant chats. */
export const aiRouter = Router();
aiRouter.use(requirePermission(PERMISSIONS.AI_CHAT_USE));
aiRouter.post('/chat', chatLimiter, validate({ body: chatBody }), aiController.chat);
aiRouter.get('/conversations', validate({ query: listAiConversationsQuery }), aiController.list);
aiRouter.get('/conversations/:id', validate({ params: aiConversationParams }), aiController.get);
