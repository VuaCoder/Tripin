import type { AiConversationDocument } from './ai.model';
import type { AiChatMessageDto, AiConversationDto, AiConversationSummaryDto } from './ai.types';

export function toMessageDto(message: { role: string; content: string; createdAt?: Date }): AiChatMessageDto {
  return { role: message.role as AiChatMessageDto['role'], content: message.content, createdAt: (message.createdAt ?? new Date()).toISOString() };
}

export function toSummaryDto(conversation: AiConversationDocument): AiConversationSummaryDto {
  return {
    id: conversation.id,
    title: conversation.title,
    messageCount: conversation.messageCount,
    updatedAt: (conversation as unknown as { updatedAt: Date }).updatedAt.toISOString(),
  };
}

export function toConversationDto(conversation: AiConversationDocument): AiConversationDto {
  return { ...toSummaryDto(conversation), messages: conversation.messages.map(toMessageDto) };
}
