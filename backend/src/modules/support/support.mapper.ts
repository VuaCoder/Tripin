import type { SupportTicketRecord } from './support.repository';
import type {
  ModerationTicketDto,
  TicketCategory,
  TicketDto,
  TicketMessageDto,
  TicketStatus,
  TicketSummaryDto,
} from './support.types';

type Viewer = 'owner' | 'staff';

function toMessage(message: SupportTicketRecord['messages'][number], viewer: Viewer): TicketMessageDto {
  const staff = message.authorKind === 'STAFF';
  // The owner sees "YOU" / "SUPPORT" (no staff identity); staff see who wrote what as "USER" / "SUPPORT".
  const author: TicketMessageDto['author'] = viewer === 'owner' ? (staff ? 'SUPPORT' : 'YOU') : staff ? 'SUPPORT' : 'USER';
  return { author, text: message.text, createdAt: (message.createdAt ?? new Date()).toISOString() };
}

export function toTicketSummary(ticket: SupportTicketRecord): TicketSummaryDto {
  return {
    id: ticket.id,
    subject: ticket.subject,
    category: ticket.category as TicketCategory,
    status: ticket.status as TicketStatus,
    bookingId: ticket.bookingId ? ticket.bookingId : undefined,
    messageCount: ticket.messageCount,
    lastMessageAt: ticket.lastMessageAt.toISOString(),
    createdAt: ticket.createdAt.toISOString(),
  };
}

export function toTicketDto(ticket: SupportTicketRecord, viewer: Viewer = 'owner'): TicketDto {
  return { ...toTicketSummary(ticket), messages: ticket.messages.map((m) => toMessage(m, viewer)) };
}

export function toModerationTicketDto(ticket: SupportTicketRecord): ModerationTicketDto {
  return {
    ...toTicketDto(ticket, 'staff'),
    userId: ticket.userId,
    assignedTo: ticket.assignedToId ?? undefined,
  };
}
