import type { PersistedRole } from '@travel-platform/constants';
import type { UserSummary } from '../users';
import type { ConversationDocument, MessageDocument } from './chat.model';
import type { ChatSide, ConversationDto, MessageDto } from './chat.types';

export function sideOf(conversation: Pick<ConversationDocument, 'travelerId' | 'guideId'>, userId: string): ChatSide | null {
  if (String(conversation.travelerId) === userId) return 'traveler';
  if (String(conversation.guideId) === userId) return 'guide';
  return null;
}

export function toConversationDto(conversation: ConversationDocument, side: ChatSide, counterpart?: UserSummary): ConversationDto {
  const last = conversation.lastMessage;
  return {
    id: conversation.id,
    counterpart: counterpart
      ? { id: counterpart.id, fullName: counterpart.fullName, avatarUrl: counterpart.avatarUrl, role: counterpart.role as PersistedRole }
      : null,
    tourId: conversation.tourId ? String(conversation.tourId) : undefined,
    lastMessage: last ? { text: last.text, senderId: String(last.senderId), sentAt: last.sentAt.toISOString() } : undefined,
    unreadCount: side === 'traveler' ? conversation.unreadTraveler : conversation.unreadGuide,
    updatedAt: conversation.lastActivityAt.toISOString(),
  };
}

export function toMessageDto(message: MessageDocument, viewerId: string): MessageDto {
  return {
    id: message.id,
    conversationId: String(message.conversationId),
    senderId: String(message.senderId),
    text: message.text,
    isMine: String(message.senderId) === viewerId,
    createdAt: (message as unknown as { createdAt: Date }).createdAt.toISOString(),
    readAt: message.readAt?.toISOString(),
  };
}
