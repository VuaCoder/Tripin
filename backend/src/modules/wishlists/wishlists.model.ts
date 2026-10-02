import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

/** One document per (traveler, tour): a saved tour. */
const wishlistItemSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tourId: { type: Schema.Types.ObjectId, ref: 'Tour', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// A tour can be saved once per traveler (also makes "add" idempotent and race-safe).
wishlistItemSchema.index({ userId: 1, tourId: 1 }, { unique: true });
// "My wishlist", newest first.
wishlistItemSchema.index({ userId: 1, createdAt: -1, _id: -1 });

export type WishlistItemAttributes = InferSchemaType<typeof wishlistItemSchema>;
export type WishlistItemDocument = HydratedDocument<WishlistItemAttributes>;
export const WishlistItemModel = model('WishlistItem', wishlistItemSchema);
