import type { SupportTicketDocument } from './support.model';
import type {
  ModerationTicketDto,
  TicketCategory,
  TicketDto,
  TicketMessageDto,
  TicketStatus,
  TicketSummaryDto,
} from './support.types';

type Viewer = 'owner' | 'staff';

function toMessage(message: SupportTicketDocument['messages'][number], viewer: Viewer): TicketMessageDto {
  const staff = message.authorKind === 'STAFF';
  // The owner sees "YOU" / "SUPPORT" (no staff identity); staff see who wrote what as "USER" / "SUPPORT".
  const author: TicketMessageDto['author'] = viewer === 'owner' ? (staff ? 'SUPPORT' : 'YOU') : staff ? 'SUPPORT' : 'USER';
  return { author, text: message.text, createdAt: (message.createdAt ?? new Date()).toISOString() };
}

export function toTicketSummary(ticket: SupportTicketDocument): TicketSummaryDto {
  return {
    id: ticket.id,
    subject: ticket.subject,
    category: ticket.category as TicketCategory,
    status: ticket.status as TicketStatus,
    bookingId: ticket.bookingId ? String(ticket.bookingId) : undefined,
    messageCount: ticket.messageCount,
    lastMessageAt: ticket.lastMessageAt.toISOString(),
    createdAt: (ticket as unknown as { createdAt: Date }).createdAt.toISOString(),
  };
}

export function toTicketDto(ticket: SupportTicketDocument, viewer: Viewer = 'owner'): TicketDto {
  return { ...toTicketSummary(ticket), messages: ticket.messages.map((m) => toMessage(m, viewer)) };
}

export function toModerationTicketDto(ticket: SupportTicketDocument): ModerationTicketDto {
  return {
    ...toTicketDto(ticket, 'staff'),
    userId: String(ticket.userId),
    assignedTo: ticket.assignedTo ? String(ticket.assignedTo) : undefined,
  };
}
