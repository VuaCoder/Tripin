import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { BOOKING_CANCEL_REASON, BOOKING_STATUS, PROMOTION_SCOPE } from '@travel-platform/constants';

const contactSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
  },
  { _id: false },
);

const promotionSnapshotSchema = new Schema(
  {
    promotionId: { type: Schema.Types.ObjectId, ref: 'Promotion', required: true },
    code: { type: String, required: true },
    scope: { type: String, enum: Object.values(PROMOTION_SCOPE), required: true },
    discountAmount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const bookingSchema = new Schema(
  {
    /** Human friendly unique reference printed on the e-ticket, e.g. TRP-K7M2QX9A. */
    bookingCode: { type: String, required: true, unique: true },
    travelerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    agencyId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tourId: { type: Schema.Types.ObjectId, ref: 'Tour', required: true },
    departureId: { type: Schema.Types.ObjectId, required: true },

    // Snapshots: later edits of the tour never change an existing booking.
    tourTitle: { type: String, required: true },
    departureDate: { type: Date, required: true },
    /** departureDate + durationDays; the booking becomes COMPLETED after this moment. */
    endDate: { type: Date, required: true },

    participants: { type: Number, required: true, min: 1 },
    contact: { type: contactSchema, required: true },
    notes: { type: String, trim: true, maxlength: 500 },

    // Money (integer VND), all computed server-side.
    unitPrice: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    promotion: { type: promotionSnapshotSchema },
    discountAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    commissionBps: { type: Number, required: true, min: 0, max: 10_000 },
    commissionAmount: { type: Number, required: true, min: 0 },
    agencyAmount: { type: Number, required: true, min: 0 },

    status: { type: String, enum: Object.values(BOOKING_STATUS), default: BOOKING_STATUS.PENDING },
    isPaid: { type: Boolean, default: false },
    /** Set when a paid booking is cancelled (or paid too late): somebody must refund the traveler. */
    refundRequired: { type: Boolean, default: false },
    paymentExpiresAt: { type: Date },
    confirmedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    cancelReason: { type: String, enum: Object.values(BOOKING_CANCEL_REASON) },
    cancelNote: { type: String, trim: true, maxlength: 500 },

    /** Client generated key that makes "create booking" safe to retry (double click / network retry). */
    clientRequestId: { type: String, maxlength: 64 },
  },
  { timestamps: true },
);

// Traveler "my bookings".
bookingSchema.index({ travelerId: 1, createdAt: -1, _id: -1 });
// Agency "bookings status" with status / tour filters.
bookingSchema.index({ agencyId: 1, status: 1, createdAt: -1, _id: -1 });
// Agency list without a status filter (sorted by creation) - the compound index above needs the status equality.
bookingSchema.index({ agencyId: 1, createdAt: -1, _id: -1 });
bookingSchema.index({ tourId: 1, departureId: 1, status: 1 });
// Dashboards: paid bookings per month / per day (match status + confirmedAt range).
bookingSchema.index({ status: 1, confirmedAt: -1 });
// Maintenance jobs.
bookingSchema.index({ status: 1, paymentExpiresAt: 1 });
bookingSchema.index({ status: 1, endDate: 1 });
// Idempotent creation per traveler.
bookingSchema.index({ travelerId: 1, clientRequestId: 1 }, { unique: true, partialFilterExpression: { clientRequestId: { $type: 'string' } } });

export type BookingAttributes = InferSchemaType<typeof bookingSchema>;
export type BookingDocument = HydratedDocument<BookingAttributes>;
export const BookingModel = model('Booking', bookingSchema);
