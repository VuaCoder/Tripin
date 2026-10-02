import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { PERSISTED_ROLES } from '@travel-platform/constants';

const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorRole: { type: String, enum: PERSISTED_ROLES, required: true },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  // Append-only: no updatedAt, no update/delete endpoints.
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Admin screen: newest first, optionally filtered by action / actor / target.
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

export type AuditLogAttributes = InferSchemaType<typeof auditLogSchema>;
export type AuditLogDocument = HydratedDocument<AuditLogAttributes>;
export const AuditLogModel = model('AuditLog', auditLogSchema);
