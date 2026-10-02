import { nullIfNotFound, prisma, type Prisma } from '../../config/database';
import type { AiConversation, AiMessage } from '../../generated/prisma/client';
import { toSkip, type PageRequest } from '../../utils/pagination';
import { AI_LIMITS } from './ai.types';

export type AiMessageRecord = AiMessage;

/** A stored conversation. `messages` is loaded by `findOwned`/`create`/`appendMessages` and empty in list results. */
export type AiConversationRecord = AiConversation & { messages: AiMessageRecord[] };

type NewMessage = { role: 'user' | 'assistant'; content: string };

const withMessages = { messages: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } } satisfies Prisma.AiConversationInclude;

export class AiRepository {
  create(userId: string, title: string, messages: NewMessage[]): Promise<AiConversationRecord> {
    return prisma.aiConversation.create({
      data: { userId, title, messageCount: messages.length, messages: { create: withSequentialTimes(messages) } },
      include: withMessages,
    });
  }

  /** Only returns the conversation if it belongs to `userId`. */
  findOwned(id: string, userId: string): Promise<AiConversationRecord | null> {
    return prisma.aiConversation.findFirst({ where: { id, userId }, include: withMessages });
  }

  /** Appends messages only while the conversation stays within its size limit (guard in the filter, atomic). */
  async appendMessages(id: string, userId: string, messages: NewMessage[]): Promise<AiConversationRecord | null> {
    const maxBefore = AI_LIMITS.MAX_MESSAGES_PER_CONVERSATION - messages.length;
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.aiConversation.update({
          where: { id, userId, messageCount: { lte: maxBefore } },
          data: { messageCount: { increment: messages.length }, updatedAt: new Date() },
        });
        await tx.aiMessage.createMany({ data: withSequentialTimes(messages).map((m) => ({ ...m, conversationId: id })) });
        return tx.aiConversation.findUniqueOrThrow({ where: { id }, include: withMessages });
      });
    } catch (error) {
      return nullIfNotFound(error);
    }
  }

  async listByUser(userId: string, page: PageRequest) {
    const [rows, total] = await Promise.all([
      // Lists only need title/count, so the messages are not loaded.
      prisma.aiConversation.findMany({ where: { userId }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], skip: toSkip(page), take: page.limit }),
      prisma.aiConversation.count({ where: { userId } }),
    ]);
    return { items: rows.map((row): AiConversationRecord => ({ ...row, messages: [] })), total };
  }
}

/** Messages of one turn share a request; a 1 ms step keeps their order stable when read back by `createdAt`. */
function withSequentialTimes(messages: NewMessage[]) {
  const start = Date.now();
  return messages.map((m, index) => ({ ...m, createdAt: new Date(start + index) }));
}

export const aiRepository = new AiRepository();
