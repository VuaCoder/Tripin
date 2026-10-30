import type { ETicketRecord, EnrichedETicketRecord } from './e-tickets.repository';
import { ETICKET_STATUS, type ETicketDto, type ETicketStatus, type GuideCheckInDto, type GuideRosterItemDto } from './e-tickets.types';

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
            meetingPoint: enriched.tourDetails.meetingPoint ?? undefined,
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

/** Roster row: `usedAt` is the check-in stamp; a USED ticket (trip completed) counts as present too. */
export function toGuideRosterItem(ticket: ETicketRecord): GuideRosterItemDto {
  return {
    ticketId: ticket.id,
    bookingCode: ticket.bookingCode,
    holderName: ticket.holderName,
    participants: ticket.participants,
    departureDate: ticket.departureDate.toISOString(),
    checkedIn: ticket.usedAt !== null || ticket.status === ETICKET_STATUS.USED,
    ...(ticket.usedAt ? { checkedInAt: ticket.usedAt.toISOString() } : {}),
  };
}

export function toGuideCheckIn(ticket: ETicketRecord, tourTitle: string): GuideCheckInDto {
  return {
    ticketId: ticket.id,
    holderName: ticket.holderName,
    participants: ticket.participants,
    tourTitle,
    checkedInAt: (ticket.usedAt ?? new Date()).toISOString(),
  };
}

