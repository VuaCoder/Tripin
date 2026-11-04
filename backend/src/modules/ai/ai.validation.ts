import { z } from 'zod';
import { containsProfanity, PROFANITY_ERROR_MESSAGE } from '@travel-platform/constants';
import { idParamsSchema, idSchema } from '../../utils/id';
import { paginationQuerySchema } from '../../utils/pagination';
import { AI_LIMITS } from './ai.types';

export const chatBody = z
  .object({
    conversationId: idSchema.optional(),
    message: z
      .string()
      .trim()
      .min(1)
      .max(AI_LIMITS.MAX_USER_MESSAGE_LENGTH)
      .refine((msg) => !containsProfanity(msg), PROFANITY_ERROR_MESSAGE),
  })
  .strict();

export const listAiConversationsQuery = paginationQuerySchema;
export const aiConversationParams = idParamsSchema;
export const aiReadBody = z.object({ throughMessageId: idSchema }).strict();

export type ChatBody = z.infer<typeof chatBody>;
export type ListAiConversationsQueryInput = z.infer<typeof listAiConversationsQuery>;
