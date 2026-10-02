import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { REVIEW_STATUS } from './reviews.types';

const reviewSchema = new Schema(
  {
    /** One review per completed booking (unique). */
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    tourId: { type: Schema.Types.ObjectId, ref: 'Tour', required: true },
    tourTitle: { type: String, required: true },
    agencyId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    travelerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true, maxlength: 2000 },

    status: { type: String, enum: Object.values(REVIEW_STATUS), default: REVIEW_STATUS.VISIBLE },
    hiddenReason: { type: String, trim: true, maxlength: 500 },
    moderatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    moderatedAt: { type: Date },
  },
  { timestamps: true },
);

// Public list of a tour / of an agency (VISIBLE only), newest first and by rating.
reviewSchema.index({ tourId: 1, status: 1, createdAt: -1, _id: -1 });
reviewSchema.index({ tourId: 1, status: 1, rating: -1 });
reviewSchema.index({ agencyId: 1, status: 1, createdAt: -1, _id: -1 });
// "My reviews".
reviewSchema.index({ travelerId: 1, createdAt: -1 });
// Moderator queue.
reviewSchema.index({ status: 1, createdAt: -1 });

export type ReviewAttributes = InferSchemaType<typeof reviewSchema>;
export type ReviewDocument = HydratedDocument<ReviewAttributes>;
export const ReviewModel = model('Review', reviewSchema);
