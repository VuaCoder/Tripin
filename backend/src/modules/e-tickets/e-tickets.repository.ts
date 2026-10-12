import { nullIfNotFound, prisma } from '../../config/database';
import type { ETicket } from '../../generated/prisma/client';
import { toSkip, type PageRequest } from '../../utils/pagination';
import type { ETicketStatus } from './e-tickets.types';

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
}

export const eTicketsRepository = new ETicketsRepository();

