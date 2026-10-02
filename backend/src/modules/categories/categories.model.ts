import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 1000 },
    /** "Deleting" a category deactivates it so existing tours keep a valid reference. */
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Public list: active categories ordered for display.
categorySchema.index({ isActive: 1, sortOrder: 1, name: 1 });

export type CategoryAttributes = InferSchemaType<typeof categorySchema>;
export type CategoryDocument = HydratedDocument<CategoryAttributes>;
export const CategoryModel = model('Category', categorySchema);
