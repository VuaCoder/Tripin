import { isUniqueViolation } from '../../config/database';
import { randomInt } from 'node:crypto';
import { AppError } from '../../utils/app-error';
import { buildPage, type Page } from '../../utils/pagination';
import type { BookingFacts } from '../bookings';
import { NOTIFICATION_TYPE, notificationsService, type NotificationsService } from '../notifications';
import { toETicketDto, toGuideCheckIn, toGuideRosterItem } from './e-tickets.mapper';
import type { ETicketRecord } from './e-tickets.repository';
import { eTicketsRepository, type ETicketsRepository } from './e-tickets.repository';
import {
  ETICKET_POLICY,
  ETICKET_STATUS,
  type ETicketDto,
  type GuideCheckInDto,
  type GuideRosterDto,
  type ListETicketsQuery,
} from './e-tickets.types';

export function generateTicketCode(): string {
  const { CODE_ALPHABET, CODE_LENGTH, CODE_PREFIX } = ETICKET_POLICY;
  const body = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)]).join('');
  return `${CODE_PREFIX}-${body}`;
}

export class ETicketsService {
  constructor(
    private readonly tickets: Pick<
      ETicketsRepository,
      'create' | 'findById' | 'findByBookingId' | 'transitionByBooking' | 'listByTraveler' | 'findAcceptedAssignment' | 'findByCode' | 'listByTour' | 'markCheckedIn'
    > = eTicketsRepository,
    private readonly notifications: Pick<NotificationsService, 'notify'> = notificationsService,
  ) {}

  // ------------------------------------------- Reacting to bookings

  /**
   * Issues the ticket of a CONFIRMED booking. Idempotent (one ticket per booking): a repeated event returns the
   * existing ticket and sends nothing again. The traveler is notified in-app and by email.
   */
  async issueForBooking(booking: BookingFacts): Promise<ETicketDto> {
    const existing = await this.tickets.findByBookingId(booking.id);
    if (existing) return toETicketDto(existing);

    const ticket = await this.createWithUniqueCode(booking);
    if (!ticket.fresh) return toETicketDto(ticket.doc);

    await this.notifications.notify(
      booking.travelerId,
      {
        type: NOTIFICATION_TYPE.ETICKET_ISSUED,
        title: `Vé điện tử ${ticket.doc.code} cho ${booking.tourTitle}`,
        body: `Vé điện tử ${ticket.doc.code} cho "${booking.tourTitle}" (đặt chỗ ${booking.bookingCode}) đã sẵn sàng trong tài khoản của bạn.`,
        data: {
          bookingId: booking.id,
          eTicketId: ticket.doc.id,
          ticketCode: ticket.doc.code,
          bookingCode: booking.bookingCode,
          tourTitle: booking.tourTitle,
          departureDate: booking.departureDate instanceof Date ? booking.departureDate.toISOString() : String(booking.departureDate),
          participants: String(booking.participants),
          contactName: booking.contactName,
          totalAmount: String(booking.totalAmount),
        },
      },
      { email: true },
    );
    return toETicketDto(ticket.doc);
  }

  /** Booking cancelled -> the ticket stops being valid. No-op when there is no ticket or it was already closed. */
  async cancelForBooking(bookingId: string): Promise<void> {
    await this.tickets.transitionByBooking(bookingId, ETICKET_STATUS.VALID, ETICKET_STATUS.CANCELLED);
  }

  /** Booking completed (trip took place) -> VALID -> USED. */
  async markUsedForBooking(bookingId: string): Promise<void> {
    await this.tickets.transitionByBooking(bookingId, ETICKET_STATUS.VALID, ETICKET_STATUS.USED);
  }

  // ------------------------------------------------- Traveler

  /** Use case "Receive E-ticket" (pull side): the traveler's tickets, newest first. */
  async listMine(travelerId: string, query: ListETicketsQuery): Promise<Page<ETicketDto>> {
    const { items, total } = await this.tickets.listByTraveler(travelerId, query);
    return buildPage(items.map(toETicketDto), total, query);
  }

  async getMine(travelerId: string, id: string): Promise<ETicketDto> {
    return toETicketDto(this.assertOwner(travelerId, await this.tickets.findById(id)));
  }

  /** Convenience for the post-payment screen: the ticket of one of my bookings. */
  async getMineByBooking(travelerId: string, bookingId: string): Promise<ETicketDto> {
    return toETicketDto(this.assertOwner(travelerId, await this.tickets.findByBookingId(bookingId)));
  }

  // ------------------------------------------------- Tour guide check-in

  /** Use case "Scan QR check-in": the roster of the tour the guide is leading. */
  async rosterForGuide(guideId: string, tourId: string): Promise<GuideRosterDto> {
    const assignment = await this.assertGuideTour(guideId, tourId);
    const items = (await this.tickets.listByTour(tourId)).map(toGuideRosterItem);
    return {
      tourId,
      tourTitle: assignment.tour.title,
      total: items.length,
      checkedIn: items.filter((item) => item.checkedIn).length,
      items,
    };
  }

  /**
   * Validates a ticket code against the guide's tour and stamps `usedAt` once. The ticket stays VALID so the
   * traveler's e-ticket is not displayed as completed before the trip actually ends.
   */
  async checkInForGuide(guideId: string, tourId: string, code: string): Promise<GuideCheckInDto> {
    const assignment = await this.assertGuideTour(guideId, tourId);
    const normalized = code.trim().toUpperCase();
    const ticket = await this.tickets.findByCode(normalized);
    if (!ticket) throw AppError.notFound('Ticket not found', 'TICKET_NOT_FOUND');
    if (ticket.tourId !== tourId) throw AppError.conflict('This ticket belongs to another tour', 'TICKET_WRONG_TOUR');
    if (ticket.status === ETICKET_STATUS.CANCELLED) throw AppError.conflict('This ticket was cancelled', 'TICKET_CANCELLED');
    if (ticket.status === ETICKET_STATUS.USED || ticket.usedAt) throw AppError.conflict('This ticket was already checked in', 'TICKET_ALREADY_USED');

    const updated = await this.tickets.markCheckedIn(ticket.id);
    if (!updated) {
      const current = await this.tickets.findByCode(normalized);
      if (!current) throw AppError.notFound('Ticket not found', 'TICKET_NOT_FOUND');
      if (current.status === ETICKET_STATUS.CANCELLED) throw AppError.conflict('This ticket was cancelled', 'TICKET_CANCELLED');
      if (current.status === ETICKET_STATUS.USED || current.usedAt) throw AppError.conflict('This ticket was already checked in', 'TICKET_ALREADY_USED');
      throw AppError.conflict('The ticket changed, please retry', 'CONCURRENT_UPDATE');
    }
    return toGuideCheckIn(updated, assignment.tour.title);
  }

  // ----------------------------------------------------- helpers

  /** 404 for a tour the guide does not lead (or one that was archived), so assignments are not enumerable. */
  private async assertGuideTour(guideId: string, tourId: string): Promise<{ tour: { title: string } }> {
    const assignment = await this.tickets.findAcceptedAssignment(tourId, guideId);
    if (!assignment) throw AppError.notFound('Assigned tour not found');
    return assignment;
  }

  /** 404 (never 403) for a missing ticket or somebody else's, so ticket ids are not enumerable. */
  private assertOwner(travelerId: string, ticket: ETicketRecord | null): ETicketRecord {
    if (!ticket || ticket.travelerId !== travelerId) throw AppError.notFound('E-ticket not found');
    return ticket;
  }

  private async createWithUniqueCode(booking: BookingFacts): Promise<{ doc: ETicketRecord; fresh: boolean }> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        const doc = await this.tickets.create({
          bookingId: booking.id,
          bookingCode: booking.bookingCode,
          code: generateTicketCode(),
          travelerId: booking.travelerId,
          agencyId: booking.agencyId,
          tourId: booking.tourId,
          tourTitle: booking.tourTitle,
          departureDate: booking.departureDate,
          participants: booking.participants,
          holderName: booking.contactName,
          issuedAt: new Date(),
        });
        return { doc, fresh: true };
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        if (isUniqueViolation(error, 'bookingId')) {
          // Two events raced: the other one created it.
          const existing = await this.tickets.findByBookingId(booking.id);
          if (existing) return { doc: existing, fresh: false };
        }
        if (attempt >= ETICKET_POLICY.CODE_MAX_ATTEMPTS) throw error;
      }
    }
  }
}

export const eTicketsService = new ETicketsService();
