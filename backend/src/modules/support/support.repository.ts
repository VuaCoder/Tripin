import { isUniqueViolation, nullIfNotFound, prisma, type Prisma } from '../../config/database';
import type { SupportTicket, SupportTicketMessage } from '../../generated/prisma/client';
import { toSkip, type PageRequest } from '../../utils/pagination';
import { SUPPORT_LIMITS, type ListModerationTicketsQuery, type TicketStatus } from './support.types';
import { AppError } from '../../utils/app-error';
import { enqueueMail } from '../notifications/mail-outbox';

export type TicketMessageRecord = SupportTicketMessage;

/** A stored ticket. `messages` is loaded by `findById`/`appendMessage` and left empty in list results. */
export type SupportTicketRecord = SupportTicket & { messages: TicketMessageRecord[] };

export type NewTicketMessage = { authorId: string; authorKind: 'USER' | 'STAFF'; text: string };

export type NewTicket = Pick<SupportTicket, 'userId' | 'subject' | 'category'> & Partial<Pick<SupportTicket, 'bookingId'>> & { message: NewTicketMessage };

const withMessages = { messages: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } } satisfies Prisma.SupportTicketInclude;

export class SupportRepository {
  async staffTransition(id: string, actorId: string, resolve: boolean, note?: string, message?: string): Promise<SupportTicketRecord> {
    return prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.findUnique({ where: { id } });
      if (!ticket) throw AppError.notFound('Ticket not found');
      if (!['OPEN', 'IN_PROGRESS'].includes(ticket.status)) throw AppError.conflict('Ticket is no longer open');
      if (resolve && !ticket.assignedToId) throw AppError.badRequest('Claim the ticket before resolving it');
      if (ticket.assignedToId && ticket.assignedToId !== actorId) throw AppError.forbidden('Only the assigned staff member can handle this ticket');
      if (resolve && (!note || note.trim().length < 10)) throw AppError.badRequest('Resolution note must contain at least 10 characters');
      if (message && ticket.messageCount >= SUPPORT_LIMITS.MAX_MESSAGES_PER_TICKET) throw AppError.conflict('Ticket message limit reached');
      const updated = await tx.supportTicket.updateMany({ where: { id, status: ticket.status, assignedToId: ticket.assignedToId, messageCount: ticket.messageCount }, data: {
        status: resolve ? 'RESOLVED' : 'IN_PROGRESS', assignedToId: actorId,
        ...(resolve ? { resolutionNote: note!.trim(), resolvedAt: new Date() } : {}),
        ...(message ? { messageCount: { increment: 1 }, lastMessageAt: new Date() } : {}),
      } });
      if (updated.count !== 1) throw AppError.conflict('Ticket changed; reload and try again', 'CONCURRENT_UPDATE');
      if (message) await tx.supportTicketMessage.create({ data: { ticketId: id, authorId: actorId, authorKind: 'STAFF', text: message } });
      if (resolve) {
        const user = await tx.user.findUnique({ where: { id: ticket.userId } });
        if (user) await enqueueMail(tx, `support-resolved:${id}:${ticket.updatedAt.toISOString()}`, user.email, `Đã giải quyết yêu cầu ${ticket.supportCode}`, `${ticket.supportCode} — ${ticket.subject}\n${note!.trim()}`);
      }
      return tx.supportTicket.findUniqueOrThrow({ where: { id }, include: withMessages });
    });
  }

  /** Creates the ticket together with its first message. */
  async create(data: NewTicket): Promise<SupportTicketRecord> {
    const { message, ...ticket } = data;
    for (let attempt = 0; ; attempt++) {
      try {
        return await prisma.supportTicket.create({
          data: { ...ticket, messageCount: 1, messages: { create: message } }, include: withMessages,
        });
      } catch (error) { if (attempt >= 3 || !isUniqueViolation(error, 'supportCode')) throw error; }
    }
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
