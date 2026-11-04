import type { AiConversationRecord } from './ai.repository';
import type { AiChatMessageDto, AiConversationDto, AiConversationSummaryDto } from './ai.types';

export function toMessageDto(message: { id?: string; role: string; content: string; createdAt?: Date }): AiChatMessageDto {
  return { id: message.id!, role: message.role as AiChatMessageDto['role'], content: message.content, createdAt: (message.createdAt ?? new Date()).toISOString() };
}

export function toSummaryDto(conversation: AiConversationRecord): AiConversationSummaryDto {
  return {
    id: conversation.id,
    title: conversation.title,
    messageCount: conversation.messageCount,
    updatedAt: conversation.updatedAt.toISOString(),
    lastMessage: conversation.messages.length ? toMessageDto(conversation.messages[conversation.messages.length - 1]!) : null,
    unreadCount: conversation.unreadCount ?? conversation.messages.filter(m => m.role === 'assistant' && m.readAt === null).length,
  };
}

export function toConversationDto(conversation: AiConversationRecord): AiConversationDto {
  return { ...toSummaryDto(conversation), messages: conversation.messages.map(toMessageDto) };
}
