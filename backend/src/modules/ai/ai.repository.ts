import { toSkip, type PageRequest } from '../../utils/pagination';
import { AiConversationModel, type AiConversationDocument } from './ai.model';
import { AI_LIMITS } from './ai.types';

export class AiRepository {
  create(userId: string, title: string, messages: { role: 'user' | 'assistant'; content: string }[]): Promise<AiConversationDocument> {
    return AiConversationModel.create({ userId, title, messages, messageCount: messages.length });
  }

  /** Only returns the conversation if it belongs to `userId`. */
  findOwned(id: string, userId: string): Promise<AiConversationDocument | null> {
    return AiConversationModel.findOne({ _id: id, userId }).exec();
  }

  /** Appends messages only while the conversation stays within its size limit (guard in the filter, atomic). */
  appendMessages(
    id: string,
    userId: string,
    messages: { role: 'user' | 'assistant'; content: string }[],
  ): Promise<AiConversationDocument | null> {
    const maxBefore = AI_LIMITS.MAX_MESSAGES_PER_CONVERSATION - messages.length;
    return AiConversationModel.findOneAndUpdate(
      { _id: id, userId, [`messages.${maxBefore}`]: { $exists: false } },
      { $push: { messages: { $each: messages.map((m) => ({ ...m, createdAt: new Date() })) } }, $inc: { messageCount: messages.length } },
      { returnDocument: 'after' },
    ).exec();
  }

  async listByUser(userId: string, page: PageRequest) {
    const [items, total] = await Promise.all([
      // `messages` is excluded (lists only need title/count); the summary mapper never touches it.
      AiConversationModel.find({ userId }, { messages: 0 })
        .sort({ updatedAt: -1, _id: -1 })
        .skip(toSkip(page))
        .limit(page.limit)
        .exec() as unknown as Promise<AiConversationDocument[]>,
      AiConversationModel.countDocuments({ userId }).exec(),
    ]);
    return { items, total };
  }
}

export const aiRepository = new AiRepository();
