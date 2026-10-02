import type { AuditLogDocument } from './audit.model';
import type { AuditLogDto } from './audit.types';

export function toAuditLogDto(log: AuditLogDocument): AuditLogDto {
  return {
    id: log.id,
    actorId: String(log.actorId),
    actorRole: log.actorRole,
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId ?? undefined,
    metadata: (log.metadata as Record<string, unknown> | undefined) ?? undefined,
    createdAt: (log as unknown as { createdAt: Date }).createdAt.toISOString(),
  };
}
