import { PAYMENT_STATUS, type PaymentPurpose, type PaymentStatus } from '@travel-platform/constants';
import { nullIfNotFound, prisma } from '../../config/database';
import type { Payment } from '../../generated/prisma/client';

/** A stored payment. The gateway order code is a 64-bit column but always below 2^53, so it is exposed as a number. */
export type PaymentRecord = Omit<Payment, 'providerOrderCode'> & { providerOrderCode: number };

type PaymentScalars = Omit<Payment, 'id' | 'createdAt' | 'updatedAt' | 'providerOrderCode'>;

export type NewPayment = Pick<Payment, 'purpose' | 'userId' | 'referenceId' | 'amount' | 'description' | 'provider' | 'expiresAt'> &
  Partial<PaymentScalars> & { providerOrderCode: number };

/** Plain-field changes (`null` clears a nullable column). */
export type PaymentPatch = Partial<PaymentScalars>;

function toRecord(row: Payment): PaymentRecord {
  return { ...row, providerOrderCode: Number(row.providerOrderCode) };
}

const toRecords = (rows: Payment[]) => rows.map(toRecord);

export class PaymentsRepository {
  async create(data: NewPayment): Promise<PaymentRecord> {
    return toRecord(await prisma.payment.create({ data: { ...data, providerOrderCode: BigInt(data.providerOrderCode) } }));
  }

  async findById(id: string): Promise<PaymentRecord | null> {
    const row = await prisma.payment.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async findByOrderCode(orderCode: number): Promise<PaymentRecord | null> {
    const row = await prisma.payment.findUnique({ where: { providerOrderCode: BigInt(orderCode) } });
    return row ? toRecord(row) : null;
  }

  /** A still-usable pending payment for the same thing (so a double click reuses the same link). */
  async findLivePending(purpose: PaymentPurpose, referenceId: string, now: Date): Promise<PaymentRecord | null> {
    const row = await prisma.payment.findFirst({ where: { purpose, referenceId, status: PAYMENT_STATUS.PENDING, expiresAt: { gt: now } } });
    return row ? toRecord(row) : null;
  }

  /** The open payment of this booking / subscription, expired or not (there is at most one, see the unique partial index). */
  async findPending(purpose: PaymentPurpose, referenceId: string): Promise<PaymentRecord | null> {
    const row = await prisma.payment.findFirst({ where: { purpose, referenceId, status: PAYMENT_STATUS.PENDING } });
    return row ? toRecord(row) : null;
  }

  async updateById(id: string, patch: PaymentPatch): Promise<PaymentRecord | null> {
    const row = await prisma.payment.update({ where: { id }, data: patch }).catch(nullIfNotFound);
    return row ? toRecord(row) : null;
  }

  /** Compare-and-set on status; null when the payment already left the expected status (e.g. a concurrent webhook won). */
  async transition(id: string, expected: readonly PaymentStatus[], patch: PaymentPatch): Promise<PaymentRecord | null> {
    const row = await prisma.payment.update({ where: { id, status: { in: [...expected] } }, data: patch }).catch(nullIfNotFound);
    return row ? toRecord(row) : null;
  }

  /** Marks the business effect as applied, once. Returns null if it was already marked. */
  async markFulfilled(id: string): Promise<PaymentRecord | null> {
    const row = await prisma.payment.update({ where: { id, status: PAYMENT_STATUS.PAID, fulfilledAt: null }, data: { fulfilledAt: new Date() } }).catch(nullIfNotFound);
    return row ? toRecord(row) : null;
  }

  /** PAID payments whose business effect was not applied yet (a fulfilment handler failed): retried by the job. */
  async findPaidUnfulfilled(limit: number): Promise<PaymentRecord[]> {
    return toRecords(await prisma.payment.findMany({ where: { status: PAYMENT_STATUS.PAID, fulfilledAt: null }, take: limit }));
  }

  /** Sum and count of PAID payments of one purpose (dashboards). */
  async paidTotal(purpose: PaymentPurpose): Promise<{ amount: number; count: number }> {
    const total = await prisma.payment.aggregate({ where: { purpose, status: PAYMENT_STATUS.PAID }, _sum: { amount: true }, _count: { _all: true } });
    return { amount: total._sum.amount ?? 0, count: total._count._all };
  }

  async findExpiredPending(now: Date, limit: number): Promise<PaymentRecord[]> {
    return toRecords(await prisma.payment.findMany({ where: { status: PAYMENT_STATUS.PENDING, expiresAt: { lt: now } }, take: limit }));
  }
}

export const paymentsRepository = new PaymentsRepository();
