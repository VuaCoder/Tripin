import type { AuditLogRecord } from './audit.repository';
import type { AuditLogDto } from './audit.types';

export function toAuditLogDto(log: AuditLogRecord): AuditLogDto {
  return {
    id: log.id,
    actorId: log.actorId,
    actorRole: log.actorRole,
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId ?? undefined,
    metadata: (log.metadata as Record<string, unknown> | null) ?? undefined,
    createdAt: log.createdAt.toISOString(),
  };
}
