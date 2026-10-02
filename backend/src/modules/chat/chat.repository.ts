import { toSkip, type PageRequest } from '../../utils/pagination';
import {
  ConversationModel,
  MessageModel,
  type ConversationAttributes,
  type ConversationDocument,
  type MessageDocument,
} from './chat.model';
import type { ChatSide } from './chat.types';

export class ChatRepository {
  // ---- conversations
  findConversation(id: string): Promise<ConversationDocument | null> {
    return ConversationModel.findById(id).exec();
  }

  findByPair(travelerId: string, guideId: string): Promise<ConversationDocument | null> {
    return ConversationModel.findOne({ travelerId, guideId }).exec();
  }

  createConversation(data: Partial<ConversationAttributes>): Promise<ConversationDocument> {
    return ConversationModel.create(data);
  }

  async listConversations(side: ChatSide, userId: string, page: PageRequest) {
    const filter = side === 'traveler' ? { travelerId: userId } : { guideId: userId };
    const [items, total] = await Promise.all([
      ConversationModel.find(filter).sort({ lastActivityAt: -1, _id: -1 }).skip(toSkip(page)).limit(page.limit).exec(),
      ConversationModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  /**
   * Records a new message on the conversation and bumps the OTHER side's unread counter, atomically.
   * Returns the document as it was BEFORE the update (the caller needs the previous unread count).
   */
  recordMessage(
    conversationId: string,
    recipient: ChatSide,
    last: { text: string; senderId: string; sentAt: Date },
  ): Promise<ConversationDocument | null> {
    const unreadField = recipient === 'traveler' ? 'unreadTraveler' : 'unreadGuide';
    return ConversationModel.findByIdAndUpdate(
      conversationId,
      { $set: { lastMessage: last, lastActivityAt: last.sentAt }, $inc: { [unreadField]: 1 } },
      { returnDocument: 'before' },
    ).exec();
  }

  resetUnread(conversationId: string, side: ChatSide): Promise<unknown> {
    const unreadField = side === 'traveler' ? 'unreadTraveler' : 'unreadGuide';
    return ConversationModel.updateOne({ _id: conversationId }, { $set: { [unreadField]: 0 } }).exec();
  }

  // ---- messages
  createMessage(data: { conversationId: string; senderId: string; text: string }): Promise<MessageDocument> {
    return MessageModel.create(data);
  }

  /** Newest first. `before` is a message id (cursor). Fetches one extra row to know whether more exist. */
  async listMessages(conversationId: string, limit: number, before?: string): Promise<{ items: MessageDocument[]; hasMore: boolean }> {
    const filter: Record<string, unknown> = { conversationId };
    if (before) filter._id = { $lt: before };
    const rows = await MessageModel.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .exec();
    return { items: rows.slice(0, limit), hasMore: rows.length > limit };
  }

  /** Marks the other person's unread messages as read. */
  markMessagesRead(conversationId: string, readerId: string): Promise<unknown> {
    return MessageModel.updateMany(
      { conversationId, senderId: { $ne: readerId }, readAt: { $exists: false } },
      { $set: { readAt: new Date() } },
    ).exec();
  }
}

export const chatRepository = new ChatRepository();
