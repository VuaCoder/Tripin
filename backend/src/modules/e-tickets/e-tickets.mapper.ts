import type { ETicketRecord, EnrichedETicketRecord } from './e-tickets.repository';
import type { ETicketDto, ETicketStatus } from './e-tickets.types';

export function toETicketDto(ticket: ETicketRecord | EnrichedETicketRecord): ETicketDto {
  const enriched = ticket as EnrichedETicketRecord;
  return {
    id: ticket.id,
    code: ticket.code,
    status: ticket.status as ETicketStatus,
    booking: {
      id: ticket.bookingId,
      code: ticket.bookingCode,
      ...(enriched.bookingDetails
        ? {
            status: enriched.bookingDetails.status,
            isPaid: enriched.bookingDetails.isPaid,
            totalAmount: enriched.bookingDetails.totalAmount,
            contactPhone: enriched.bookingDetails.contactPhone,
            endDate: enriched.bookingDetails.endDate.toISOString(),
          }
        : {}),
    },
    tour: {
      id: ticket.tourId,
      title: ticket.tourTitle,
      ...(enriched.tourDetails
        ? {
            destination: enriched.tourDetails.destination,
            durationDays: enriched.tourDetails.durationDays,
            coverImage: enriched.tourDetails.images?.[0],
          }
        : {}),
    },
    departureDate: ticket.departureDate.toISOString(),
    participants: ticket.participants,
    holderName: ticket.holderName,
    issuedAt: ticket.issuedAt.toISOString(),
  };
}

