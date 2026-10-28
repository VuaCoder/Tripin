import { GUIDE_ASSIGNMENT_STATUS, TOUR_STATUS } from '@travel-platform/constants';
import { nullIfNotFound, prisma } from '../../config/database';
import type { ETicket } from '../../generated/prisma/client';
import { toSkip, type PageRequest } from '../../utils/pagination';
import { ETICKET_STATUS, type ETicketStatus } from './e-tickets.types';

export type ETicketRecord = ETicket;

export interface EnrichedETicketRecord extends ETicketRecord {
  bookingDetails?: {
    id: string;
    bookingCode: string;
    status: string;
    isPaid: boolean;
    totalAmount: number;
    contactPhone: string;
    endDate: Date;
  } | null;
  tourDetails?: {
    id: string;
    title: string;
    destination: string;
    durationDays: number;
    images: string[];
  } | null;
}

export type NewETicket = Omit<ETicket, 'id' | 'status' | 'cancelledAt' | 'usedAt' | 'createdAt' | 'updatedAt'> & Partial<Pick<ETicket, 'status'>>;

export class ETicketsRepository {
  create(data: NewETicket): Promise<ETicketRecord> {
    return prisma.eTicket.create({ data });
  }

  async findById(id: string): Promise<EnrichedETicketRecord | null> {
    const ticket = await prisma.eTicket.findUnique({ where: { id } });
    if (!ticket) return null;
    return this.enrich(ticket);
  }

  async findByBookingId(bookingId: string): Promise<EnrichedETicketRecord | null> {
    const ticket = await prisma.eTicket.findUnique({ where: { bookingId } });
    if (!ticket) return null;
    return this.enrich(ticket);
  }

  private async enrich(ticket: ETicketRecord): Promise<EnrichedETicketRecord> {
    const [booking, tour] = await Promise.all([
      prisma.booking.findUnique({
        where: { id: ticket.bookingId },
        select: {
          id: true,
          bookingCode: true,
          status: true,
          isPaid: true,
          totalAmount: true,
          contactPhone: true,
          endDate: true,
        },
      }),
      prisma.tour.findUnique({
        where: { id: ticket.tourId },
        select: {
          id: true,
          title: true,
          destination: true,
          durationDays: true,
          images: true,
        },
      }),
    ]);
    return {
      ...ticket,
      bookingDetails: booking,
      tourDetails: tour,
    };
  }

  /** Compare-and-set on the status; null when the ticket is not in the expected status (or does not exist). */
  transitionByBooking(bookingId: string, expected: ETicketStatus, next: ETicketStatus): Promise<ETicketRecord | null> {
    const stamp = next === 'CANCELLED' ? { cancelledAt: new Date() } : next === 'USED' ? { usedAt: new Date() } : {};
    return prisma.eTicket.update({ where: { bookingId, status: expected }, data: { status: next, ...stamp } }).catch(nullIfNotFound);
  }

  async listByTraveler(travelerId: string, page: PageRequest) {
    const [items, total] = await Promise.all([
      prisma.eTicket.findMany({ where: { travelerId }, orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }], skip: toSkip(page), take: page.limit }),
      prisma.eTicket.count({ where: { travelerId } }),
    ]);
    return { items, total };
  }

  // ------------------------------------------------------- Guide check-in

  /** The tour the guide is actually leading: an ACCEPTED assignment on a non-archived tour. */
  findAcceptedAssignment(tourId: string, guideId: string): Promise<{ tour: { title: string } } | null> {
    return prisma.tourGuideAssignment.findFirst({
      where: {
        tourId,
        guideId,
        status: GUIDE_ASSIGNMENT_STATUS.ACCEPTED,
        tour: { is: { status: { not: TOUR_STATUS.ARCHIVED } } },
      },
      select: { tour: { select: { title: true } } },
    });
  }

  findByCode(code: string): Promise<ETicketRecord | null> {
    return prisma.eTicket.findUnique({ where: { code } });
  }

  /** Roster of a tour; cancelled tickets are not part of the group. */
  listByTour(tourId: string): Promise<ETicketRecord[]> {
    return prisma.eTicket.findMany({
      where: { tourId, status: { not: ETICKET_STATUS.CANCELLED } },
      orderBy: [{ departureDate: 'asc' }, { holderName: 'asc' }, { id: 'asc' }],
    });
  }

  /**
   * Stamps the attendance time once. `status` stays VALID so the traveler's ticket is not shown as
   * completed before the trip; `usedAt` is the check-in marker. Null when it was already stamped
   * (or the ticket left VALID), so the service can answer with the precise conflict.
   */
  markCheckedIn(id: string): Promise<ETicketRecord | null> {
    return prisma.eTicket
      .update({ where: { id, status: ETICKET_STATUS.VALID, usedAt: null }, data: { usedAt: new Date() } })
      .catch(nullIfNotFound);
  }
}

export const eTicketsRepository = new ETicketsRepository();

