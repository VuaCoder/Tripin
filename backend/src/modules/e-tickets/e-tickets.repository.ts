import { toSkip, type PageRequest } from '../../utils/pagination';
import { ETicketModel, type ETicketAttributes, type ETicketDocument } from './e-tickets.model';
import type { ETicketStatus } from './e-tickets.types';

export class ETicketsRepository {
  create(data: Partial<ETicketAttributes>): Promise<ETicketDocument> {
    return ETicketModel.create(data);
  }

  findById(id: string): Promise<ETicketDocument | null> {
    return ETicketModel.findById(id).exec();
  }

  findByBookingId(bookingId: string): Promise<ETicketDocument | null> {
    return ETicketModel.findOne({ bookingId }).exec();
  }

  /** Compare-and-set on the status; null when the ticket is not in the expected status (or does not exist). */
  transitionByBooking(bookingId: string, expected: ETicketStatus, next: ETicketStatus): Promise<ETicketDocument | null> {
    const stamp = next === 'CANCELLED' ? { cancelledAt: new Date() } : next === 'USED' ? { usedAt: new Date() } : {};
    return ETicketModel.findOneAndUpdate({ bookingId, status: expected }, { $set: { status: next, ...stamp } }, { returnDocument: 'after' }).exec();
  }

  async listByTraveler(travelerId: string, page: PageRequest) {
    const [items, total] = await Promise.all([
      ETicketModel.find({ travelerId }).sort({ issuedAt: -1, _id: -1 }).skip(toSkip(page)).limit(page.limit).exec(),
      ETicketModel.countDocuments({ travelerId }).exec(),
    ]);
    return { items, total };
  }
}

export const eTicketsRepository = new ETicketsRepository();
