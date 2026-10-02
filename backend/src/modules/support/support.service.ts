import type { PersistedRole } from '@travel-platform/constants';
import { AppError } from '../../utils/app-error';
import { buildPage, type Page } from '../../utils/pagination';
import { assertTransition } from '../../utils/state-machine';
import { bookingsService, type BookingsService } from '../bookings';
import { NOTIFICATION_TYPE, notificationsService, type NotificationsService } from '../notifications';
import { toModerationTicketDto, toTicketDto, toTicketSummary } from './support.mapper';
import type { SupportTicketDocument } from './support.model';
import { supportRepository, type SupportRepository } from './support.repository';
import {
  SUPPORT_LIMITS,
  TICKET_STATUS,
  TICKET_TRANSITIONS,
  type CreateTicketInput,
  type ListModerationTicketsQuery,
  type ListTicketsQuery,
  type ModerationTicketDto,
  type TicketDto,
  type TicketStatus,
  type TicketSummaryDto,
} from './support.types';

type Actor = { userId: string; role: PersistedRole };
const ENTITY = 'Ticket';

export class SupportService {
  constructor(
    private readonly tickets: Pick<
      SupportRepository,
      'create' | 'findById' | 'appendMessage' | 'transition' | 'listByUser' | 'listForModeration' | 'countByStatus'
    > = supportRepository,
    private readonly bookings: Pick<BookingsService, 'getFacts'> = bookingsService,
    private readonly notifications: Pick<NotificationsService, 'notify'> = notificationsService,
  ) {}

  // ================================================================ Traveler

  /** Use case "Send ticket": a help request with a first message. */
  async createTicket(userId: string, input: CreateTicketInput): Promise<TicketDto> {
    if (input.bookingId) {
      const booking = await this.bookings.getFacts(input.bookingId);
      if (!booking || booking.travelerId !== userId) throw AppError.notFound('Booking not found');
    }
    const ticket = await this.tickets.create({
      userId: userId as never,
      subject: input.subject,
      category: input.category,
      ...(input.bookingId ? { bookingId: input.bookingId as never } : {}),
      messages: [{ authorId: userId, authorKind: 'USER', text: input.message, createdAt: new Date() }] as never,
      messageCount: 1,
      lastMessageAt: new Date(),
    });
    return toTicketDto(ticket);
  }

  async listMine(userId: string, query: ListTicketsQuery): Promise<Page<TicketSummaryDto>> {
    const { items, total } = await this.tickets.listByUser(userId, query.status, query);
    return buildPage(items.map(toTicketSummary), total, query);
  }

  async getMine(userId: string, id: string): Promise<TicketDto> {
    return toTicketDto(await this.requireOwned(userId, id));
  }

  /** Adds a message. Writing on a RESOLVED ticket re-opens it (IN_PROGRESS); a CLOSED ticket accepts nothing. */
  async replyAsOwner(userId: string, id: string, text: string): Promise<TicketDto> {
    const ticket = await this.requireOwned(userId, id);
    if (ticket.status === TICKET_STATUS.CLOSED) throw AppError.conflict('This ticket is closed', 'TICKET_CLOSED');

    const next: TicketStatus = ticket.status === TICKET_STATUS.RESOLVED ? TICKET_STATUS.IN_PROGRESS : (ticket.status as TicketStatus);
    if (next !== ticket.status) assertTransition(TICKET_TRANSITIONS, ticket.status as TicketStatus, next, ENTITY);

    const updated = await this.tickets.appendMessage(id, [ticket.status as TicketStatus], { authorId: userId, authorKind: 'USER', text }, next);
    if (!updated) throw this.appendFailure(ticket);
    return toTicketDto(updated);
  }

  /** The owner closes the ticket (problem solved or no longer relevant). Final. */
  async closeMine(userId: string, id: string): Promise<TicketDto> {
    const ticket = await this.requireOwned(userId, id);
    assertTransition(TICKET_TRANSITIONS, ticket.status as TicketStatus, TICKET_STATUS.CLOSED, ENTITY);
    const closed = await this.tickets.transition(id, [ticket.status as TicketStatus], TICKET_STATUS.CLOSED);
    if (!closed) throw AppError.conflict('The ticket changed, please retry', 'CONCURRENT_UPDATE');
    return toTicketDto(closed);
  }

  // ============================================================== Moderation

  /** Called by `moderation` ("Handle complaints"): the support queue, oldest waiting first. */
  async listForModeration(query: ListModerationTicketsQuery): Promise<Page<TicketSummaryDto>> {
    const { items, total } = await this.tickets.listForModeration(query);
    return buildPage(items.map(toTicketSummary), total, query);
  }

  async getForModeration(id: string): Promise<ModerationTicketDto> {
    const ticket = await this.tickets.findById(id);
    if (!ticket) throw AppError.notFound('Ticket not found');
    return toModerationTicketDto(ticket);
  }

  /**
   * A moderator answers. OPEN/IN_PROGRESS -> IN_PROGRESS, or RESOLVED when `resolve` is set. The first answering
   * moderator becomes the assignee. The user is notified in-app and by email.
   */
  async replyAsStaff(actor: Actor, id: string, input: { text: string; resolve?: boolean }): Promise<ModerationTicketDto> {
    const ticket = await this.tickets.findById(id);
    if (!ticket) throw AppError.notFound('Ticket not found');
    const next = input.resolve ? TICKET_STATUS.RESOLVED : TICKET_STATUS.IN_PROGRESS;
    if (ticket.status === TICKET_STATUS.RESOLVED || ticket.status === TICKET_STATUS.CLOSED) {
      throw AppError.invalidTransition(ticket.status, next, ENTITY);
    }
    if (next !== ticket.status) assertTransition(TICKET_TRANSITIONS, ticket.status as TicketStatus, next, ENTITY);

    const updated = await this.tickets.appendMessage(
      id,
      [ticket.status as TicketStatus],
      { authorId: actor.userId, authorKind: 'STAFF', text: input.text },
      next,
      ticket.assignedTo ? {} : { assignedTo: actor.userId },
    );
    if (!updated) throw this.appendFailure(ticket);

    await this.notifications.notify(
      String(ticket.userId),
      {
        type: NOTIFICATION_TYPE.SUPPORT_REPLIED,
        title: input.resolve ? 'Your support ticket was resolved' : 'Support replied to your ticket',
        body: `Re: ${ticket.subject}`,
        data: { ticketId: id },
      },
      { email: true },
    );
    return toModerationTicketDto(updated);
  }

  /** Status change without a message (e.g. claim a ticket, or mark it resolved). */
  async setStatus(_actor: Actor, id: string, next: 'IN_PROGRESS' | 'RESOLVED'): Promise<ModerationTicketDto> {
    const ticket = await this.tickets.findById(id);
    if (!ticket) throw AppError.notFound('Ticket not found');
    assertTransition(TICKET_TRANSITIONS, ticket.status as TicketStatus, next, ENTITY);
    const updated = await this.tickets.transition(id, [ticket.status as TicketStatus], next);
    if (!updated) throw AppError.conflict('The ticket changed, please retry', 'CONCURRENT_UPDATE');
    if (next === TICKET_STATUS.RESOLVED) {
      await this.notifications.notify(String(ticket.userId), {
        type: NOTIFICATION_TYPE.SUPPORT_REPLIED,
        title: 'Your support ticket was resolved',
        body: `Re: ${ticket.subject}`,
        data: { ticketId: id },
      });
    }
    return toModerationTicketDto(updated);
  }

  /** Tickets per status (dashboards). */
  async countByStatus(): Promise<Record<string, number>> {
    const rows = await this.tickets.countByStatus();
    return Object.fromEntries(rows.map((row) => [row._id, row.count]));
  }

  // =============================================================== helpers

  private async requireOwned(userId: string, id: string): Promise<SupportTicketDocument> {
    const ticket = await this.tickets.findById(id);
    if (!ticket || String(ticket.userId) !== userId) throw AppError.notFound('Ticket not found');
    return ticket;
  }

  private appendFailure(ticket: SupportTicketDocument): AppError {
    return ticket.messageCount >= SUPPORT_LIMITS.MAX_MESSAGES_PER_TICKET
      ? AppError.conflict('This ticket has reached its message limit, please open a new one', 'TICKET_FULL')
      : AppError.conflict('The ticket changed, please retry', 'CONCURRENT_UPDATE');
  }
}

export const supportService = new SupportService();
