import { AppError } from '../../utils/app-error';
import { buildPage, type Page } from '../../utils/pagination';
import { toConversationDto, toMessageDto, toSummaryDto } from './ai.mapper';
import { aiRepository, type AiRepository } from './ai.repository';
import {
  AI_LIMITS,
  AI_SYSTEM_PROMPT,
  type AiChatInput,
  type AiChatResultDto,
  type AiConversationDto,
  type AiConversationSummaryDto,
} from './ai.types';
import { createAiProvider, type AiMessage, type AiProvider } from './providers';

export class AiService {
  constructor(
    private readonly conversations: Pick<AiRepository, 'create' | 'findOwned' | 'appendMessages' | 'listByUser'> = aiRepository,
    private readonly provider: AiProvider = createAiProvider(),
  ) {}

  /**
   * Use case "Chat with AI" (Traveler <-> AI Agent). Flow (AI rules §14): validated user text -> model -> the answer is
   * returned to the user as advice. Nothing the model says is interpreted as data or stored anywhere except this chat
   * transcript, and the model has no tools: it cannot create bookings, change prices or read other users' data.
   */
  async chat(userId: string, input: AiChatInput): Promise<AiChatResultDto> {
    if (!this.provider.enabled) throw AppError.unavailable('The AI assistant is not enabled');

    const existing = input.conversationId ? await this.requireOwned(userId, input.conversationId) : null;
    if (existing && existing.messageCount >= AI_LIMITS.MAX_MESSAGES_PER_CONVERSATION) {
      throw AppError.conflict('This conversation is full, please start a new one', 'AI_CONVERSATION_FULL');
    }

    const history: AiMessage[] = (existing?.messages ?? []).slice(-AI_LIMITS.CONTEXT_MESSAGES).map((m) => ({
      role: m.role as AiMessage['role'],
      content: m.content,
    }));
    const { text } = await this.provider.generate({
      system: AI_SYSTEM_PROMPT,
      messages: [...history, { role: 'user', content: input.message }],
      maxTokens: AI_LIMITS.MAX_OUTPUT_TOKENS,
    });

    // Only a successful exchange is stored, so a provider outage never leaves a dangling user message.
    const reply = text.slice(0, AI_LIMITS.MAX_STORED_REPLY_LENGTH);
    const turn = [
      { role: 'user' as const, content: input.message },
      { role: 'assistant' as const, content: reply },
    ];
    let saved;
    if (existing) {
      saved = await this.conversations.appendMessages(existing.id, userId, turn);
      if (!saved) throw AppError.conflict('This conversation is full, please start a new one', 'AI_CONVERSATION_FULL');
    } else {
      saved = await this.conversations.create(userId, input.message.slice(0, AI_LIMITS.TITLE_LENGTH), turn);
    }

    const assistantMessage = saved.messages[saved.messages.length - 1]!;
    return { conversationId: saved.id, reply: toMessageDto(assistantMessage), messageCount: saved.messageCount };
  }

  async listMine(userId: string, page: { page: number; limit: number }): Promise<Page<AiConversationSummaryDto>> {
    const { items, total } = await this.conversations.listByUser(userId, page);
    return buildPage(items.map(toSummaryDto), total, page);
  }

  async getMine(userId: string, id: string): Promise<AiConversationDto> {
    return toConversationDto(await this.requireOwned(userId, id));
  }

  /** 404 for unknown ids and for other users' conversations. */
  private async requireOwned(userId: string, id: string) {
    const conversation = await this.conversations.findOwned(id, userId);
    if (!conversation) throw AppError.notFound('Conversation not found');
    return conversation;
  }
}

export const aiService = new AiService();
