import { z } from 'zod';
import { idParamsSchema, objectIdSchema } from '../../utils/object-id';
import { paginationQuerySchema } from '../../utils/pagination';
import { CHAT_LIMITS } from './chat.types';

export const startConversationBody = z.object({ participantId: objectIdSchema, tourId: objectIdSchema.optional() }).strict();

export const sendMessageBody = z.object({ text: z.string().trim().min(1).max(CHAT_LIMITS.MAX_MESSAGE_LENGTH) }).strict();

export const listConversationsQuery = paginationQuerySchema;

export const listMessagesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(CHAT_LIMITS.MAX_PAGE_SIZE).default(CHAT_LIMITS.DEFAULT_PAGE_SIZE),
  before: objectIdSchema.optional(),
});

export const conversationIdParams = idParamsSchema;

/** Payloads of the Socket.IO events are validated with the same rules as the REST bodies. */
export const socketSendPayload = z.object({ conversationId: objectIdSchema, text: sendMessageBody.shape.text }).strict();
export const socketConversationPayload = z.object({ conversationId: objectIdSchema }).strict();

export type StartConversationBody = z.infer<typeof startConversationBody>;
export type SendMessageBody = z.infer<typeof sendMessageBody>;
export type ListConversationsQueryInput = z.infer<typeof listConversationsQuery>;
export type ListMessagesQueryInput = z.infer<typeof listMessagesQuery>;
