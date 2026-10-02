import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const lastMessageSchema = new Schema(
  {
    text: { type: String, required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sentAt: { type: Date, required: true },
  },
  { _id: false },
);

const conversationSchema = new Schema(
  {
    travelerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    guideId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    /** Tour the conversation started from (context only). */
    tourId: { type: Schema.Types.ObjectId, ref: 'Tour' },
    lastMessage: { type: lastMessageSchema },
    /** Unread counters per side. */
    unreadTraveler: { type: Number, default: 0, min: 0 },
    unreadGuide: { type: Number, default: 0, min: 0 },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// One conversation per traveler/guide pair (also makes "start conversation" idempotent).
conversationSchema.index({ travelerId: 1, guideId: 1 }, { unique: true });
// Inbox of each side, most recent first.
conversationSchema.index({ travelerId: 1, lastActivityAt: -1, _id: -1 });
conversationSchema.index({ guideId: 1, lastActivityAt: -1, _id: -1 });

const messageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, maxlength: 2000 },
    readAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Message history of one conversation, newest first (cursor pagination by _id).
messageSchema.index({ conversationId: 1, _id: -1 });

export type ConversationAttributes = InferSchemaType<typeof conversationSchema>;
export type ConversationDocument = HydratedDocument<ConversationAttributes>;
export const ConversationModel = model('Conversation', conversationSchema);

export type MessageAttributes = InferSchemaType<typeof messageSchema>;
export type MessageDocument = HydratedDocument<MessageAttributes>;
export const MessageModel = model('Message', messageSchema);
