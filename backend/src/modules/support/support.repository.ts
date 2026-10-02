import { nullIfNotFound, prisma, type Prisma } from '../../config/database';
import type { SupportTicket, SupportTicketMessage } from '../../generated/prisma/client';
import { toSkip, type PageRequest } from '../../utils/pagination';
import { SUPPORT_LIMITS, type ListModerationTicketsQuery, type TicketStatus } from './support.types';

export type TicketMessageRecord = SupportTicketMessage;

/** A stored ticket. `messages` is loaded by `findById`/`appendMessage` and left empty in list results. */
export type SupportTicketRecord = SupportTicket & { messages: TicketMessageRecord[] };

export type NewTicketMessage = { authorId: string; authorKind: 'USER' | 'STAFF'; text: string };

export type NewTicket = Pick<SupportTicket, 'userId' | 'subject' | 'category'> & Partial<Pick<SupportTicket, 'bookingId'>> & { message: NewTicketMessage };

const withMessages = { messages: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } } satisfies Prisma.SupportTicketInclude;

export class SupportRepository {
  /** Creates the ticket together with its first message. */
  create(data: NewTicket): Promise<SupportTicketRecord> {
    const { message, ...ticket } = data;
    return prisma.supportTicket.create({
      data: { ...ticket, messageCount: 1, messages: { create: message } },
      include: withMessages,
    });
  }

  findById(id: string): Promise<SupportTicketRecord | null> {
    return prisma.supportTicket.findUnique({ where: { id }, include: withMessages });
  }

  /**
   * Appends a message only while the ticket is in one of the expected statuses and below the size cap (atomic), and
   * moves it to `nextStatus`. Returns null when the guard failed (status changed concurrently, ticket full or closed).
   */
  async appendMessage(
    id: string,
    expected: readonly TicketStatus[],
    message: NewTicketMessage,
    nextStatus: TicketStatus,
    extra: Partial<Pick<SupportTicket, 'assignedToId'>> = {},
  ): Promise<SupportTicketRecord | null> {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.supportTicket.update({
          where: { id, status: { in: [...expected] }, messageCount: { lt: SUPPORT_LIMITS.MAX_MESSAGES_PER_TICKET } },
          data: { status: nextStatus, lastMessageAt: new Date(), messageCount: { increment: 1 }, ...extra },
        });
        await tx.supportTicketMessage.create({ data: { ticketId: id, ...message } });
        return tx.supportTicket.findUniqueOrThrow({ where: { id }, include: withMessages });
      });
    } catch (error) {
      return nullIfNotFound(error);
    }
  }

  /** Compare-and-set status change (no message). */
  transition(id: string, expected: readonly TicketStatus[], next: TicketStatus): Promise<SupportTicketRecord | null> {
    return prisma.supportTicket
      .update({
        where: { id, status: { in: [...expected] } },
        data: { status: next, ...(next === 'CLOSED' ? { closedAt: new Date() } : {}) },
        include: withMessages,
      })
      .catch(nullIfNotFound);
  }

  listByUser(userId: string, status: TicketStatus | undefined, page: PageRequest) {
    return this.paginate({ userId, ...(status ? { status } : {}) }, [{ lastMessageAt: 'desc' }, { id: 'desc' }], page);
  }

  listForModeration(query: ListModerationTicketsQuery) {
    const where: Prisma.SupportTicketWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;
    // Waiting tickets first-come-first-served; finished ones newest first.
    const waiting = !query.status || query.status === 'OPEN' || query.status === 'IN_PROGRESS';
    return this.paginate(where, waiting ? [{ createdAt: 'asc' }, { id: 'asc' }] : [{ lastMessageAt: 'desc' }, { id: 'desc' }], query);
  }

  async countByStatus(): Promise<{ status: TicketStatus; count: number }[]> {
    const rows = await prisma.supportTicket.groupBy({ by: ['status'], _count: { _all: true } });
    return rows.map((row) => ({ status: row.status, count: row._count._all }));
  }

  private async paginate(where: Prisma.SupportTicketWhereInput, orderBy: Prisma.SupportTicketOrderByWithRelationInput[], page: PageRequest) {
    const [rows, total] = await Promise.all([
      prisma.supportTicket.findMany({ where, orderBy, skip: toSkip(page), take: page.limit }),
      prisma.supportTicket.count({ where }),
    ]);
    return { items: rows.map((row): SupportTicketRecord => ({ ...row, messages: [] })), total };
  }
}

export const supportRepository = new SupportRepository();
