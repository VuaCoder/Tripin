import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { TICKET_CATEGORY, TICKET_STATUS } from './support.types';

const ticketMessageSchema = new Schema(
  {
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    /** USER = the person who opened the ticket, STAFF = a moderator. */
    authorKind: { type: String, enum: ['USER', 'STAFF'], required: true },
    text: { type: String, required: true, maxlength: 4000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const supportTicketSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: String, enum: Object.values(TICKET_CATEGORY), required: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    status: { type: String, enum: Object.values(TICKET_STATUS), default: TICKET_STATUS.OPEN },
    /** The moderator who first answered. */
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    messages: { type: [ticketMessageSchema], default: [] },
    messageCount: { type: Number, default: 0, min: 0 },
    lastMessageAt: { type: Date, default: Date.now },
    closedAt: { type: Date },
  },
  { timestamps: true },
);

// "My tickets".
supportTicketSchema.index({ userId: 1, lastMessageAt: -1 });
// Moderator queue (oldest open first) and per-category filter.
supportTicketSchema.index({ status: 1, createdAt: 1 });
// Moderator queue with no status filter: oldest first.
supportTicketSchema.index({ createdAt: 1 });
supportTicketSchema.index({ category: 1, status: 1, createdAt: 1 });

export type SupportTicketAttributes = InferSchemaType<typeof supportTicketSchema>;
export type SupportTicketDocument = HydratedDocument<SupportTicketAttributes>;
export const SupportTicketModel = model('SupportTicket', supportTicketSchema);
