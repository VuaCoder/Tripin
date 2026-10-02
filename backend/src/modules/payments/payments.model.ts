import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { PAYMENT_PURPOSE, PAYMENT_STATUS } from '@travel-platform/constants';

const paymentSchema = new Schema(
  {
    purpose: { type: String, enum: Object.values(PAYMENT_PURPOSE), required: true },
    /** The payer. */
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    /** What is being paid for: a booking id or a subscription id (depends on `purpose`). */
    referenceId: { type: Schema.Types.ObjectId, required: true },
    /** Integer VND, taken from server data (never from the client). */
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'VND' },
    description: { type: String, required: true, maxlength: 100 },

    provider: { type: String, required: true },
    /** Our unique numeric id of the order at the gateway (webhooks refer to it). */
    providerOrderCode: { type: Number, required: true, unique: true },
    providerPaymentLinkId: { type: String },
    checkoutUrl: { type: String },
    providerReference: { type: String },

    status: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.PENDING },
    expiresAt: { type: Date, required: true },
    paidAt: { type: Date },
    failureReason: { type: String, maxlength: 300 },
    /** Set once the business effect (booking confirmed / subscription activated) has been applied. Makes webhooks replay-safe. */
    fulfilledAt: { type: Date },
  },
  { timestamps: true },
);

// At most ONE open payment per booking / subscription: a double click (or two tabs) can never create two payment links.
paymentSchema.index({ purpose: 1, referenceId: 1 }, { unique: true, partialFilterExpression: { status: PAYMENT_STATUS.PENDING } });
// "My payments" and ownership checks.
paymentSchema.index({ userId: 1, createdAt: -1 });
// Expiry job.
paymentSchema.index({ status: 1, expiresAt: 1 });
// Retry job: PAID payments whose fulfilment is still missing (a missing fulfilledAt sorts as null).
paymentSchema.index({ status: 1, fulfilledAt: 1 });

export type PaymentAttributes = InferSchemaType<typeof paymentSchema>;
export type PaymentDocument = HydratedDocument<PaymentAttributes>;
export const PaymentModel = model('Payment', paymentSchema);
