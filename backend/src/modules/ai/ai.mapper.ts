import type { AiConversationRecord } from './ai.repository';
import type { AiChatMessageDto, AiConversationDto, AiConversationSummaryDto } from './ai.types';

export function toMessageDto(message: { role: string; content: string; createdAt?: Date }): AiChatMessageDto {
  return { role: message.role as AiChatMessageDto['role'], content: message.content, createdAt: (message.createdAt ?? new Date()).toISOString() };
}

export function toSummaryDto(conversation: AiConversationRecord): AiConversationSummaryDto {
  return {
    id: conversation.id,
    title: conversation.title,
    messageCount: conversation.messageCount,
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

export function toConversationDto(conversation: AiConversationRecord): AiConversationDto {
  return { ...toSummaryDto(conversation), messages: conversation.messages.map(toMessageDto) };
}
