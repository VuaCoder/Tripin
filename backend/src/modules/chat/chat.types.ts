import type { PersistedRole } from '@travel-platform/constants';

export const CHAT_LIMITS = {
  MAX_MESSAGE_LENGTH: 2000,
  MAX_PAGE_SIZE: 100,
  DEFAULT_PAGE_SIZE: 30,
} as const;

/** Which side of the conversation a user is (the diagram's chat is Traveler <-> Tour guide only, DECISIONS D-13). */
export type ChatSide = 'traveler' | 'guide';

export interface ConversationDto {
  id: string;
  counterpart: { id: string; fullName: string; avatarUrl?: string; role: PersistedRole } | null;
  tourId?: string;
  lastMessage?: { text: string; senderId: string; sentAt: string };
  /** Messages from the other person that I have not read yet. */
  unreadCount: number;
  updatedAt: string;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  isMine: boolean;
  createdAt: string;
  readAt?: string;
}

export interface MessagesPageDto {
  /** Newest first. Pass the last item's id as `before` to get the previous page. */
  items: MessageDto[];
  hasMore: boolean;
}

export interface StartConversationInput {
  participantId: string;
  tourId?: string;
}

export interface ListMessagesQuery {
  limit: number;
  before?: string;
}

/** Realtime payload pushed to a participant's sockets. */
export interface ChatMessageEvent {
  conversationId: string;
  message: MessageDto;
}

/** Set by the Socket.IO gateway; the service never imports socket code (AI rules §16). */
export type ChatPublisher = (userId: string, event: ChatMessageEvent) => void;
