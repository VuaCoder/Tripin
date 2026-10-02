import type { ETicketRecord } from './e-tickets.repository';
import type { ETicketDto, ETicketStatus } from './e-tickets.types';

export function toETicketDto(ticket: ETicketRecord): ETicketDto {
  return {
    id: ticket.id,
    code: ticket.code,
    status: ticket.status as ETicketStatus,
    booking: { id: ticket.bookingId, code: ticket.bookingCode },
    tour: { id: ticket.tourId, title: ticket.tourTitle },
    departureDate: ticket.departureDate.toISOString(),
    participants: ticket.participants,
    holderName: ticket.holderName,
    issuedAt: ticket.issuedAt.toISOString(),
  };
}
