import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

/** Generic key/value store for platform configuration (commission, policies). One document per key. */
const systemSettingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export type SystemSettingAttributes = InferSchemaType<typeof systemSettingSchema>;
export type SystemSettingDocument = HydratedDocument<SystemSettingAttributes>;
export const SystemSettingModel = model('SystemSetting', systemSettingSchema);
