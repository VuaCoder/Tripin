import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const aiMessageSchema = new Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

/**
 * A private chat between one user and the assistant. Stored text is advisory conversation only: nothing in here is
 * ever read as booking, tour or payment data (AI rules §14).
 */
const aiConversationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, maxlength: 120 },
    messages: { type: [aiMessageSchema], default: [] },
    /** Denormalised length of `messages` so lists do not load the whole array. */
    messageCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

// "My AI chats", most recently used first.
aiConversationSchema.index({ userId: 1, updatedAt: -1 });

export type AiConversationAttributes = InferSchemaType<typeof aiConversationSchema>;
export type AiConversationDocument = HydratedDocument<AiConversationAttributes>;
export const AiConversationModel = model('AiConversation', aiConversationSchema);
