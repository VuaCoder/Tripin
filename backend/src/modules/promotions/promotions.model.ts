import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { DISCOUNT_TYPE, PROMOTION_SCOPE } from '@travel-platform/constants';

const promotionSchema = new Schema(
  {
    scope: { type: String, enum: Object.values(PROMOTION_SCOPE), required: true },
    /** The agency that owns an AGENCY promotion; absent for PLATFORM promotions. */
    ownerId: { type: Schema.Types.ObjectId, ref: 'User' },
    /** Upper-case, globally unique. Immutable after creation. */
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    discountType: { type: String, enum: Object.values(DISCOUNT_TYPE), required: true },
    /** PERCENT: 1–100. FIXED: VND off the order. */
    discountValue: { type: Number, required: true, min: 1 },
    /** Cap (VND) for PERCENT discounts. */
    maxDiscountAmount: { type: Number, min: 1 },
    minOrderAmount: { type: Number, default: 0, min: 0 },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    /** Total redemptions allowed; unlimited when absent. */
    usageLimit: { type: Number, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

// Agency "my promotions" list and platform list.
promotionSchema.index({ scope: 1, ownerId: 1, createdAt: -1 });

export type PromotionAttributes = InferSchemaType<typeof promotionSchema>;
export type PromotionDocument = HydratedDocument<PromotionAttributes>;
export const PromotionModel = model('Promotion', promotionSchema);
