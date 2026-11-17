import { prisma } from '../../config/database';
import type { RefundLedger } from '../../generated/prisma/client';
import { numericRecord, type NumericRecord } from '../../utils/money';

export type RefundLedgerRecord = NumericRecord<RefundLedger>;

export type NewRefundLedger = {
  bookingId?: string | null;
  paymentId?: string | null;
  complaintTicketId?: string | null;
  userId: string;
  amount: number;
  reason: string;
  destinationHint?: string | null;
};

export class RefundLedgerRepository {
  async create(data: NewRefundLedger): Promise<RefundLedgerRecord> {
    return numericRecord(await prisma.refundLedger.create({
      data: {
        bookingId: data.bookingId ?? null,
        paymentId: data.paymentId ?? null,
        complaintTicketId: data.complaintTicketId ?? null,
        userId: data.userId,
        amount: data.amount,
        reason: data.reason,
        destinationHint: data.destinationHint ?? null,
        status: 'PENDING',
      },
    }));
  }
}

export const refundLedgerRepository = new RefundLedgerRepository();
