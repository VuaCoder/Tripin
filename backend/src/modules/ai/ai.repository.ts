import { nullIfNotFound, prisma, type Prisma } from '../../config/database';
import type { AiConversation, AiMessage } from '../../generated/prisma/client';
import { toSkip, type PageRequest } from '../../utils/pagination';
import { AI_LIMITS } from './ai.types';

export type AiMessageRecord = AiMessage;

/** Detail records load the transcript; list records load only the latest message. */
export type AiConversationRecord = AiConversation & { messages: AiMessageRecord[]; unreadCount?: number };

type NewMessage = { role: 'user' | 'assistant'; content: string };

const withMessages = { messages: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } } satisfies Prisma.AiConversationInclude;
const withSummary = {
  messages: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1 },
  _count: { select: { messages: { where: { role: 'assistant', readAt: null } } } },
} satisfies Prisma.AiConversationInclude;

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
      prisma.aiConversation.findMany({ where: { userId }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], skip: toSkip(page), take: page.limit,
        include: withSummary,
      }),
      prisma.aiConversation.count({ where: { userId } }),
    ]);
    return { items: rows.map((row): AiConversationRecord => ({ ...row, unreadCount: row._count.messages })), total };
  }

  async overview(userId: string) {
    const [latest, unreadCount] = await Promise.all([
      prisma.aiConversation.findFirst({ where: { userId }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], include: withSummary }),
      prisma.aiMessage.count({ where: { conversation: { userId }, role: 'assistant', readAt: null } }),
    ]);
    return { latest: latest ? { ...latest, unreadCount: latest._count.messages } : null, unreadCount };
  }

  async markRead(userId: string, conversationId: string, throughMessageId: string) {
    const boundary = await prisma.aiMessage.findFirst({ where: { id: throughMessageId, conversationId, conversation: { userId } } });
    if (!boundary) return null;
    await prisma.aiMessage.updateMany({ where: {
      conversationId, role: 'assistant', readAt: null,
      OR: [{ createdAt: { lt: boundary.createdAt } }, { createdAt: boundary.createdAt, id: { lte: boundary.id } }],
    }, data: { readAt: new Date() } });
    return { unreadCount: await prisma.aiMessage.count({ where: { conversationId, role: 'assistant', readAt: null } }) };
  }
}

/** Messages of one turn share a request; a 1 ms step keeps their order stable when read back by `createdAt`. */
function withSequentialTimes(messages: NewMessage[]) {
  const start = Date.now();
  return messages.map((m, index) => ({ ...m, createdAt: new Date(start + index) }));
}

export const aiRepository = new AiRepository();
