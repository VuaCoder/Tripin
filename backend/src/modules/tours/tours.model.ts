import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { GUIDE_ASSIGNMENT_STATUS, TOUR_STATUS } from '@travel-platform/constants';

const departureSchema = new Schema({
  date: { type: Date, required: true },
  capacity: { type: Number, required: true, min: 1, max: 10_000 },
  /** Seats still free. Only changed atomically by reserveSeats/releaseSeats (bookings) or capacity edits. */
  remaining: { type: Number, required: true, min: 0 },
  /** VND per person for this departure; falls back to the tour's basePrice. */
  priceOverride: { type: Number, min: 0 },
  isOpen: { type: Boolean, default: true },
});

const itineraryDaySchema = new Schema(
  {
    day: { type: Number, required: true, min: 1 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 5000 },
    activities: { type: [String], default: [] },
  },
  { _id: false },
);

const guideAssignmentSchema = new Schema(
  {
    guideId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    /** VND the agency pays the guide per completed booking (DECISIONS D-19). */
    feePerBooking: { type: Number, required: true, min: 0 },
    status: { type: String, enum: Object.values(GUIDE_ASSIGNMENT_STATUS), default: GUIDE_ASSIGNMENT_STATUS.PENDING },
    respondedAt: { type: Date },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false },
);

const tourSchema = new Schema(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    summary: { type: String, trim: true, maxlength: 500 },
    description: { type: String, trim: true, maxlength: 20_000 },
    destination: { type: String, required: true, trim: true, maxlength: 120 },
    durationDays: { type: Number, required: true, min: 1, max: 365 },
    /** Integer VND per person. */
    basePrice: { type: Number, required: true, min: 0 },
    maxGroupSize: { type: Number, min: 1, max: 10_000 },
    categoryIds: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    images: { type: [String], default: [] },
    inclusions: { type: [String], default: [] },
    exclusions: { type: [String], default: [] },
    itinerary: { type: [itineraryDaySchema], default: [] },
    departures: { type: [departureSchema], default: [] },
    guide: { type: guideAssignmentSchema },

    status: { type: String, enum: Object.values(TOUR_STATUS), default: TOUR_STATUS.DRAFT },
    submittedAt: { type: Date },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    /** Why the moderator rejected / suspended the tour; shown to the agency. */
    statusReason: { type: String, trim: true, maxlength: 1000 },

    /** Maintained by the reviews module. */
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

// Public discovery (status is always APPROVED there): default order, price sort/filter, category filter, departure filter, rating sort.
tourSchema.index({ status: 1, createdAt: -1, _id: -1 });
tourSchema.index({ status: 1, basePrice: 1, _id: 1 }); // also serves price_desc (reverse scan)
tourSchema.index({ status: 1, categoryIds: 1 });
tourSchema.index({ status: 1, ratingAvg: -1, ratingCount: -1, _id: -1 });
tourSchema.index({ status: 1, 'departures.date': 1 });
// Moderator queue: tours by status, most recently submitted first.
tourSchema.index({ status: 1, submittedAt: -1, _id: -1 });
// Agency "my tours" and guide "assigned tours".
tourSchema.index({ agencyId: 1, status: 1, updatedAt: -1 });
tourSchema.index({ 'guide.guideId': 1, status: 1 });

export type TourAttributes = InferSchemaType<typeof tourSchema>;
export type TourDocument = HydratedDocument<TourAttributes>;
export const TourModel = model('Tour', tourSchema);
