import { prisma, type Prisma } from '../../config/database';
import type { Conversation, Message } from '../../generated/prisma/client';
import { toSkip, type PageRequest } from '../../utils/pagination';
import type { ChatSide } from './chat.types';

type LastMessageColumns = 'lastMessageText' | 'lastMessageSenderId' | 'lastMessageSentAt';

export interface LastMessage {
  text: string;
  senderId: string;
  sentAt: Date;
}

/** A stored conversation; the inbox preview is exposed as one nested object. */
export type ConversationRecord = Omit<Conversation, LastMessageColumns> & { lastMessage?: LastMessage };
export type MessageRecord = Message;

export type NewConversation = Pick<Conversation, 'travelerId' | 'guideId'> & Partial<Pick<Conversation, 'tourId'>>;

function toRecord(row: Conversation): ConversationRecord {
  const { lastMessageText, lastMessageSenderId, lastMessageSentAt, ...rest } = row;
  return {
    ...rest,
    lastMessage: lastMessageText && lastMessageSenderId && lastMessageSentAt ? { text: lastMessageText, senderId: lastMessageSenderId, sentAt: lastMessageSentAt } : undefined,
  };
}

export class ChatRepository {
  // ---- conversations
  async findConversation(id: string): Promise<ConversationRecord | null> {
    const row = await prisma.conversation.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async findByPair(travelerId: string, guideId: string): Promise<ConversationRecord | null> {
    const row = await prisma.conversation.findUnique({ where: { travelerId_guideId: { travelerId, guideId } } });
    return row ? toRecord(row) : null;
  }

  async createConversation(data: NewConversation): Promise<ConversationRecord> {
    return toRecord(await prisma.conversation.create({ data }));
  }

  async listConversations(side: ChatSide, userId: string, page: PageRequest) {
    const where: Prisma.ConversationWhereInput = side === 'traveler' ? { travelerId: userId } : { guideId: userId };
    const [rows, total] = await Promise.all([
      prisma.conversation.findMany({ where, orderBy: [{ lastActivityAt: 'desc' }, { id: 'desc' }], skip: toSkip(page), take: page.limit }),
      prisma.conversation.count({ where }),
    ]);
    return { items: rows.map(toRecord), total };
  }

  /**
   * Records a new message on the conversation and bumps the OTHER side's unread counter, atomically.
   * Returns the conversation as it was BEFORE the update (the caller needs the previous unread count): the counter
   * moves by exactly one in a single statement, so the previous value is the new one minus one.
   */
  async recordMessage(conversationId: string, recipient: ChatSide, last: LastMessage): Promise<ConversationRecord | null> {
    const field = recipient === 'traveler' ? 'unreadTraveler' : 'unreadGuide';
    const updated = await prisma.conversation
      .update({
        where: { id: conversationId },
        data: { lastMessageText: last.text, lastMessageSenderId: last.senderId, lastMessageSentAt: last.sentAt, lastActivityAt: last.sentAt, [field]: { increment: 1 } },
      })
      .catch((error: { code?: string }) => {
        if (error.code === 'P2025') return null;
        throw error;
      });
    if (!updated) return null;
    const before = toRecord(updated);
    return { ...before, [field]: updated[field] - 1 };
  }

  /**
   * Creates a message and bumps the recipient's unread counter in one transaction.
   * Returns the message plus the conversation state BEFORE the unread bump (for first-unread notifications).
   */
  async appendMessageAndBumpUnread(
    data: { conversationId: string; senderId: string; text: string },
    recipient: ChatSide,
  ): Promise<{ message: MessageRecord; before: ConversationRecord | null }> {
    const unreadField = recipient === 'traveler' ? 'unreadTraveler' : 'unreadGuide';
    return prisma.$transaction(async (tx) => {
      const message = await tx.message.create({ data });
      const last = { text: data.text.slice(0, 200), senderId: data.senderId, sentAt: message.createdAt };
      const updated = await tx.conversation
        .update({
          where: { id: data.conversationId },
          data: {
            lastMessageText: last.text,
            lastMessageSenderId: last.senderId,
            lastMessageSentAt: last.sentAt,
            lastActivityAt: last.sentAt,
            [unreadField]: { increment: 1 },
          },
        })
        .catch((error: { code?: string }) => {
          if (error.code === 'P2025') return null;
          throw error;
        });
      if (!updated) return { message, before: null };
      const before = toRecord(updated);
      return { message, before: { ...before, [unreadField]: updated[unreadField] - 1 } };
    });
  }

  resetUnread(conversationId: string, side: ChatSide): Promise<unknown> {
    const field = side === 'traveler' ? 'unreadTraveler' : 'unreadGuide';
    return prisma.conversation.updateMany({ where: { id: conversationId }, data: { [field]: 0 } });
  }

  // ---- messages
  createMessage(data: { conversationId: string; senderId: string; text: string }): Promise<MessageRecord> {
    return prisma.message.create({ data });
  }

  /** Newest first. `before` is a message id (cursor). Fetches one extra row to know whether more exist. */
  async listMessages(conversationId: string, limit: number, before?: string): Promise<{ items: MessageRecord[]; hasMore: boolean }> {
    const where: Prisma.MessageWhereInput = { conversationId };
    if (before) {
      const cursor = await prisma.message.findFirst({ where: { id: before, conversationId }, select: { id: true, createdAt: true } });
      if (cursor) where.OR = [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }];
    }
    const rows = await prisma.message.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1 });
    return { items: rows.slice(0, limit), hasMore: rows.length > limit };
  }

  /** Marks the other person's unread messages as read. */
  markMessagesRead(conversationId: string, readerId: string): Promise<unknown> {
    return prisma.message.updateMany({ where: { conversationId, senderId: { not: readerId }, readAt: null }, data: { readAt: new Date() } });
  }

  /**
   * Watermark-based mark-read: stamps lastRead*At, marks prior unread messages as read, then recomputes the
   * unread counter as messages from the other side that arrived after the watermark (race-safe).
   */
  async markReadWithWatermark(
    conversationId: string,
    side: ChatSide,
    readerId: string,
    now = new Date(),
  ): Promise<{ unreadCount: number }> {
    const readField = side === 'traveler' ? 'lastReadTravelerAt' : 'lastReadGuideAt';
    const unreadField = side === 'traveler' ? 'unreadTraveler' : 'unreadGuide';
    return prisma.$transaction(async (tx) => {
      await tx.message.updateMany({
        where: { conversationId, senderId: { not: readerId }, readAt: null, createdAt: { lte: now } },
        data: { readAt: now },
      });
      await tx.conversation.update({ where: { id: conversationId }, data: { [readField]: now } });
      const unread = await tx.message.count({
        where: { conversationId, senderId: { not: readerId }, createdAt: { gt: now } },
      });
      await tx.conversation.update({ where: { id: conversationId }, data: { [unreadField]: unread } });
      return { unreadCount: unread };
    });
  }
}

export const chatRepository = new ChatRepository();
