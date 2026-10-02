export const AI_LIMITS = {
  MAX_USER_MESSAGE_LENGTH: 2000,
  /** Messages kept per conversation (user + assistant); a new chat must be started after that. */
  MAX_MESSAGES_PER_CONVERSATION: 100,
  /** Last messages sent to the model as context. */
  CONTEXT_MESSAGES: 20,
  MAX_OUTPUT_TOKENS: 1024,
  MAX_STORED_REPLY_LENGTH: 8000,
  TITLE_LENGTH: 60,
} as const;

/** Fixed instructions of the assistant. Business rules and prices are NOT given to the model: it only advises. */
export const AI_SYSTEM_PROMPT = [
  'You are Tripri\'s travel assistant for a tour marketplace in Vietnam.',
  'Help travelers think about destinations, itineraries, seasons, packing and what to ask a tour operator.',
  'You do not have access to live availability, prices or bookings and you cannot book, pay or change anything: say so when asked, and point the user to the tour pages and the booking flow.',
  'Never invent specific prices, schedules or policies of a tour or company. If unsure, say you are unsure.',
  'Do not ask for or repeat passwords, payment details or personal documents.',
  'Reply in the language the user writes in, concisely.',
].join(' ');

export interface AiChatMessageDto {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface AiConversationSummaryDto {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: string;
}

export interface AiConversationDto extends AiConversationSummaryDto {
  messages: AiChatMessageDto[];
}

export interface AiChatResultDto {
  conversationId: string;
  reply: AiChatMessageDto;
  messageCount: number;
}

export interface AiChatInput {
  conversationId?: string;
  message: string;
}
