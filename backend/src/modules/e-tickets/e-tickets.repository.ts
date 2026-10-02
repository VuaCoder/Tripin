import { nullIfNotFound, prisma } from '../../config/database';
import type { ETicket } from '../../generated/prisma/client';
import { toSkip, type PageRequest } from '../../utils/pagination';
import type { ETicketStatus } from './e-tickets.types';

export type ETicketRecord = ETicket;

export type NewETicket = Omit<ETicket, 'id' | 'status' | 'cancelledAt' | 'usedAt' | 'createdAt' | 'updatedAt'> & Partial<Pick<ETicket, 'status'>>;

export class ETicketsRepository {
  create(data: NewETicket): Promise<ETicketRecord> {
    return prisma.eTicket.create({ data });
  }

  findById(id: string): Promise<ETicketRecord | null> {
    return prisma.eTicket.findUnique({ where: { id } });
  }

  findByBookingId(bookingId: string): Promise<ETicketRecord | null> {
    return prisma.eTicket.findUnique({ where: { bookingId } });
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
