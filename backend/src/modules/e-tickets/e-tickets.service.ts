import { randomInt } from 'node:crypto';
import { AppError } from '../../utils/app-error';
import { buildPage, type Page } from '../../utils/pagination';
import type { BookingFacts } from '../bookings';
import { NOTIFICATION_TYPE, notificationsService, type NotificationsService } from '../notifications';
import { toETicketDto } from './e-tickets.mapper';
import type { ETicketDocument } from './e-tickets.model';
import { eTicketsRepository, type ETicketsRepository } from './e-tickets.repository';
import { ETICKET_POLICY, ETICKET_STATUS, type ETicketDto, type ListETicketsQuery } from './e-tickets.types';

export function generateTicketCode(): string {
  const { CODE_ALPHABET, CODE_LENGTH, CODE_PREFIX } = ETICKET_POLICY;
  const body = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)]).join('');
  return `${CODE_PREFIX}-${body}`;
}

export class ETicketsService {
  constructor(
    private readonly tickets: Pick<ETicketsRepository, 'create' | 'findById' | 'findByBookingId' | 'transitionByBooking' | 'listByTraveler'> = eTicketsRepository,
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
        title: 'Your e-ticket is ready',
        body: `E-ticket ${ticket.doc.code} for "${booking.tourTitle}" (booking ${booking.bookingCode}) is available in your account.`,
        data: { bookingId: booking.id, eTicketId: ticket.doc.id },
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

  // ----------------------------------------------------- helpers

  /** 404 (never 403) for a missing ticket or somebody else's, so ticket ids are not enumerable. */
  private assertOwner(travelerId: string, ticket: ETicketDocument | null): ETicketDocument {
    if (!ticket || String(ticket.travelerId) !== travelerId) throw AppError.notFound('E-ticket not found');
    return ticket;
  }

  private async createWithUniqueCode(booking: BookingFacts): Promise<{ doc: ETicketDocument; fresh: boolean }> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        const doc = await this.tickets.create({
          bookingId: booking.id as never,
          bookingCode: booking.bookingCode,
          code: generateTicketCode(),
          travelerId: booking.travelerId as never,
          agencyId: booking.agencyId as never,
          tourId: booking.tourId as never,
          tourTitle: booking.tourTitle,
          departureDate: booking.departureDate,
          participants: booking.participants,
          holderName: booking.contactName,
          issuedAt: new Date(),
        });
        return { doc, fresh: true };
      } catch (error) {
        const e = error as { code?: number; keyPattern?: Record<string, unknown> };
        if (e.code !== 11000) throw error;
        if (e.keyPattern && 'bookingId' in e.keyPattern) {
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
