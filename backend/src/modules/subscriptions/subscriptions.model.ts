import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { SUBSCRIPTION_STATUS } from './subscriptions.types';

const planSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 1000 },
    /** Integer VND for the whole period. */
    price: { type: Number, required: true, min: 1 },
    durationDays: { type: Number, required: true, min: 1, max: 3660 },
    benefits: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);
planSchema.index({ isActive: 1, sortOrder: 1 });

const subscriptionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    planId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
    // Snapshots: editing a plan later never changes what a subscriber bought.
    planCode: { type: String, required: true },
    planName: { type: String, required: true },
    price: { type: Number, required: true, min: 1 },
    durationDays: { type: Number, required: true, min: 1 },

    status: { type: String, enum: Object.values(SUBSCRIPTION_STATUS), default: SUBSCRIPTION_STATUS.PENDING_PAYMENT },
    startsAt: { type: Date },
    endsAt: { type: Date },
  },
  { timestamps: true },
);

// "My subscriptions" and the current-subscription lookup.
subscriptionSchema.index({ userId: 1, status: 1, endsAt: -1 });
subscriptionSchema.index({ userId: 1, createdAt: -1 });
// One unpaid subscription per user and plan (double click on "Subscribe" reuses it).
subscriptionSchema.index({ userId: 1, planId: 1 }, { unique: true, partialFilterExpression: { status: SUBSCRIPTION_STATUS.PENDING_PAYMENT } });
// Maintenance jobs.
subscriptionSchema.index({ status: 1, endsAt: 1 });
subscriptionSchema.index({ status: 1, createdAt: 1 });

export type PlanAttributes = InferSchemaType<typeof planSchema>;
export type PlanDocument = HydratedDocument<PlanAttributes>;
export const PlanModel = model('SubscriptionPlan', planSchema);

export type SubscriptionAttributes = InferSchemaType<typeof subscriptionSchema>;
export type SubscriptionDocument = HydratedDocument<SubscriptionAttributes>;
export const SubscriptionModel = model('Subscription', subscriptionSchema);
