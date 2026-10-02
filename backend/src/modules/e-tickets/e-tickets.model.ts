import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { ETICKET_STATUS } from './e-tickets.types';

const eTicketSchema = new Schema(
  {
    /** One ticket per booking (unique): makes issuing idempotent. */
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    bookingCode: { type: String, required: true },
    /** Random, unguessable value shown as QR. */
    code: { type: String, required: true, unique: true },
    travelerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    agencyId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tourId: { type: Schema.Types.ObjectId, ref: 'Tour', required: true },
    tourTitle: { type: String, required: true },
    departureDate: { type: Date, required: true },
    participants: { type: Number, required: true, min: 1 },
    holderName: { type: String, required: true },
    status: { type: String, enum: Object.values(ETICKET_STATUS), default: ETICKET_STATUS.VALID },
    issuedAt: { type: Date, required: true },
    cancelledAt: { type: Date },
    usedAt: { type: Date },
  },
  { timestamps: true },
);

// "My tickets", newest first.
eTicketSchema.index({ travelerId: 1, issuedAt: -1, _id: -1 });

export type ETicketAttributes = InferSchemaType<typeof eTicketSchema>;
export type ETicketDocument = HydratedDocument<ETicketAttributes>;
export const ETicketModel = model('ETicket', eTicketSchema);
