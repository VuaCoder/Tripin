import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { NOTIFICATION_TYPE } from './notifications.types';

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: Object.values(NOTIFICATION_TYPE), required: true },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 1000 },
    data: { type: Map, of: String },
    readAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// "My notifications", newest first (also serves the unread filter when combined with readAt).
notificationSchema.index({ userId: 1, createdAt: -1, _id: -1 });
// Unread counter / unread-only list.
notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });
// Housekeeping: notifications disappear after 180 days.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

export type NotificationAttributes = InferSchemaType<typeof notificationSchema>;
export type NotificationDocument = HydratedDocument<NotificationAttributes>;
export const NotificationModel = model('Notification', notificationSchema);
