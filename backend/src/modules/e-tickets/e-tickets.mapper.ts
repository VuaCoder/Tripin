import type { ETicketDocument } from './e-tickets.model';
import type { ETicketDto, ETicketStatus } from './e-tickets.types';

export function toETicketDto(ticket: ETicketDocument): ETicketDto {
  return {
    id: ticket.id,
    code: ticket.code,
    status: ticket.status as ETicketStatus,
    booking: { id: String(ticket.bookingId), code: ticket.bookingCode },
    tour: { id: String(ticket.tourId), title: ticket.tourTitle },
    departureDate: ticket.departureDate.toISOString(),
    participants: ticket.participants,
    holderName: ticket.holderName,
    issuedAt: ticket.issuedAt.toISOString(),
  };
}
