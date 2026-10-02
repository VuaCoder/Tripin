import type { PersistedRole } from '@travel-platform/constants';
import type { UserSummary } from '../users';
import type { ConversationRecord, MessageRecord } from './chat.repository';
import type { ChatSide, ConversationDto, MessageDto } from './chat.types';

export function sideOf(conversation: Pick<ConversationRecord, 'travelerId' | 'guideId'>, userId: string): ChatSide | null {
  if (conversation.travelerId === userId) return 'traveler';
  if (conversation.guideId === userId) return 'guide';
  return null;
}

export function toConversationDto(conversation: ConversationRecord, side: ChatSide, counterpart?: UserSummary): ConversationDto {
  const last = conversation.lastMessage;
  return {
    id: conversation.id,
    counterpart: counterpart
      ? { id: counterpart.id, fullName: counterpart.fullName, avatarUrl: counterpart.avatarUrl, role: counterpart.role as PersistedRole }
      : null,
    tourId: conversation.tourId ? conversation.tourId : undefined,
    lastMessage: last ? { text: last.text, senderId: last.senderId, sentAt: last.sentAt.toISOString() } : undefined,
    unreadCount: side === 'traveler' ? conversation.unreadTraveler : conversation.unreadGuide,
    updatedAt: conversation.lastActivityAt.toISOString(),
  };
}

export function toMessageDto(message: MessageRecord, viewerId: string): MessageDto {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    text: message.text,
    isMine: message.senderId === viewerId,
    createdAt: message.createdAt.toISOString(),
    readAt: message.readAt?.toISOString(),
  };
}
