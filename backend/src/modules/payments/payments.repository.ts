import type { UpdateQuery } from 'mongoose';
import { PAYMENT_STATUS, type PaymentPurpose, type PaymentStatus } from '@travel-platform/constants';
import { PaymentModel, type PaymentAttributes, type PaymentDocument } from './payments.model';

export class PaymentsRepository {
  create(data: Partial<PaymentAttributes>): Promise<PaymentDocument> {
    return PaymentModel.create(data);
  }

  findById(id: string): Promise<PaymentDocument | null> {
    return PaymentModel.findById(id).exec();
  }

  findByOrderCode(orderCode: number): Promise<PaymentDocument | null> {
    return PaymentModel.findOne({ providerOrderCode: orderCode }).exec();
  }

  /** A still-usable pending payment for the same thing (so a double click reuses the same link). */
  findLivePending(purpose: PaymentPurpose, referenceId: string, now: Date): Promise<PaymentDocument | null> {
    return PaymentModel.findOne({ purpose, referenceId, status: PAYMENT_STATUS.PENDING, expiresAt: { $gt: now } }).exec();
  }

  /** The open payment of this booking / subscription, expired or not (there is at most one, see the unique partial index). */
  findPending(purpose: PaymentPurpose, referenceId: string): Promise<PaymentDocument | null> {
    return PaymentModel.findOne({ purpose, referenceId, status: PAYMENT_STATUS.PENDING }).exec();
  }

  updateById(id: string, update: UpdateQuery<PaymentAttributes>): Promise<PaymentDocument | null> {
    return PaymentModel.findByIdAndUpdate(id, update, { returnDocument: 'after' }).exec();
  }

  /** Compare-and-set on status; null when the payment already left the expected status (e.g. a concurrent webhook won). */
  transition(id: string, expected: readonly PaymentStatus[], update: UpdateQuery<PaymentAttributes>): Promise<PaymentDocument | null> {
    return PaymentModel.findOneAndUpdate({ _id: id, status: { $in: expected } }, update, { returnDocument: 'after' }).exec();
  }

  /** Marks the business effect as applied, once. Returns null if it was already marked. */
  markFulfilled(id: string): Promise<PaymentDocument | null> {
    return PaymentModel.findOneAndUpdate(
      { _id: id, status: PAYMENT_STATUS.PAID, fulfilledAt: { $exists: false } },
      { $set: { fulfilledAt: new Date() } },
      { returnDocument: 'after' },
    ).exec();
  }

  /** PAID payments whose business effect was not applied yet (a fulfilment handler failed): retried by the job. */
  findPaidUnfulfilled(limit: number): Promise<PaymentDocument[]> {
    return PaymentModel.find({ status: PAYMENT_STATUS.PAID, fulfilledAt: { $exists: false } }).limit(limit).exec();
  }

  /** Sum and count of PAID payments of one purpose (dashboards). */
  async paidTotal(purpose: PaymentPurpose): Promise<{ amount: number; count: number }> {
    const [row] = await PaymentModel.aggregate<{ amount: number; count: number }>([
      { $match: { purpose, status: PAYMENT_STATUS.PAID } },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]).exec();
    return { amount: row?.amount ?? 0, count: row?.count ?? 0 };
  }

  findExpiredPending(now: Date, limit: number): Promise<PaymentDocument[]> {
    return PaymentModel.find({ status: PAYMENT_STATUS.PENDING, expiresAt: { $lt: now } }).limit(limit).exec();
  }
}

export const paymentsRepository = new PaymentsRepository();
