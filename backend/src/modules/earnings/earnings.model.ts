import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const earningSchema = new Schema(
  {
    guideId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    /** One earning per completed booking (unique): makes recording idempotent. */
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    bookingCode: { type: String, required: true },
    tourId: { type: Schema.Types.ObjectId, ref: 'Tour', required: true },
    tourTitle: { type: String, required: true },
    agencyId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0 },
    earnedAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// "My earnings" list/summary filtered by date.
earningSchema.index({ guideId: 1, earnedAt: -1, _id: -1 });

export type EarningAttributes = InferSchemaType<typeof earningSchema>;
export type EarningDocument = HydratedDocument<EarningAttributes>;
export const EarningModel = model('Earning', earningSchema);
