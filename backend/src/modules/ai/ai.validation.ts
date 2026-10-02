import { z } from 'zod';
import { idParamsSchema, objectIdSchema } from '../../utils/object-id';
import { paginationQuerySchema } from '../../utils/pagination';
import { AI_LIMITS } from './ai.types';

export const chatBody = z
  .object({
    conversationId: objectIdSchema.optional(),
    message: z.string().trim().min(1).max(AI_LIMITS.MAX_USER_MESSAGE_LENGTH),
  })
  .strict();

export const listAiConversationsQuery = paginationQuerySchema;
export const aiConversationParams = idParamsSchema;

export type ChatBody = z.infer<typeof chatBody>;
export type ListAiConversationsQueryInput = z.infer<typeof listAiConversationsQuery>;
