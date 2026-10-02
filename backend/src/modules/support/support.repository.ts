import type { QueryFilter, SortOrder, UpdateQuery } from 'mongoose';
import { toSkip, type PageRequest } from '../../utils/pagination';
import { SupportTicketModel, type SupportTicketAttributes, type SupportTicketDocument } from './support.model';
import { SUPPORT_LIMITS, type ListModerationTicketsQuery, type TicketStatus } from './support.types';

type Filter = QueryFilter<SupportTicketAttributes>;
const LIST_PROJECTION = { messages: 0 };

export class SupportRepository {
  create(data: Partial<SupportTicketAttributes>): Promise<SupportTicketDocument> {
    return SupportTicketModel.create(data);
  }

  findById(id: string): Promise<SupportTicketDocument | null> {
    return SupportTicketModel.findById(id).exec();
  }

  /**
   * Appends a message only while the ticket is in one of the expected statuses and below the size cap (atomic), and
   * moves it to `nextStatus`. Returns null when the guard failed (status changed concurrently, ticket full or closed).
   */
  appendMessage(
    id: string,
    expected: readonly TicketStatus[],
    message: { authorId: string; authorKind: 'USER' | 'STAFF'; text: string },
    nextStatus: TicketStatus,
    extra: UpdateQuery<SupportTicketAttributes>['$set'] = {},
  ): Promise<SupportTicketDocument | null> {
    const now = new Date();
    return SupportTicketModel.findOneAndUpdate(
      { _id: id, status: { $in: expected }, [`messages.${SUPPORT_LIMITS.MAX_MESSAGES_PER_TICKET - 1}`]: { $exists: false } },
      {
        $push: { messages: { ...message, createdAt: now } },
        $inc: { messageCount: 1 },
        $set: { status: nextStatus, lastMessageAt: now, ...extra },
      },
      { returnDocument: 'after' },
    ).exec();
  }

  /** Compare-and-set status change (no message). */
  transition(id: string, expected: readonly TicketStatus[], next: TicketStatus): Promise<SupportTicketDocument | null> {
    return SupportTicketModel.findOneAndUpdate(
      { _id: id, status: { $in: expected } },
      { $set: { status: next, ...(next === 'CLOSED' ? { closedAt: new Date() } : {}) } },
      { returnDocument: 'after' },
    ).exec();
  }

  listByUser(userId: string, status: TicketStatus | undefined, page: PageRequest) {
    return this.paginate({ userId, ...(status ? { status } : {}) }, { lastMessageAt: -1, _id: -1 }, page);
  }

  listForModeration(query: ListModerationTicketsQuery) {
    const filter: Filter = {};
    if (query.status) filter.status = query.status;
    if (query.category) filter.category = query.category;
    // Waiting tickets first-come-first-served; finished ones newest first.
    const waiting = !query.status || query.status === 'OPEN' || query.status === 'IN_PROGRESS';
    return this.paginate(filter, waiting ? { createdAt: 1, _id: 1 } : { lastMessageAt: -1, _id: -1 }, query);
  }

  countByStatus(): Promise<{ _id: TicketStatus; count: number }[]> {
    return SupportTicketModel.aggregate<{ _id: TicketStatus; count: number }>([{ $group: { _id: '$status', count: { $sum: 1 } } }]).exec();
  }

  private async paginate(filter: Filter, sort: Record<string, SortOrder>, page: PageRequest) {
    const [items, total] = await Promise.all([
      SupportTicketModel.find(filter, LIST_PROJECTION).sort(sort).skip(toSkip(page)).limit(page.limit).exec() as unknown as Promise<SupportTicketDocument[]>,
      SupportTicketModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }
}

export const supportRepository = new SupportRepository();
