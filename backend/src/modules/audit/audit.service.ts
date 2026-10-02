import type { Prisma } from '../../config/database';
import { buildPage, type Page } from '../../utils/pagination';
import { logger } from '../../utils/logger';
import { toAuditLogDto } from './audit.mapper';
import { auditRepository, type AuditRepository } from './audit.repository';
import type { AuditEntry, AuditLogDto, ListAuditQuery } from './audit.types';

export class AuditService {
  constructor(private readonly logs: Pick<AuditRepository, 'create' | 'list'> = auditRepository) {}

  /**
   * Appends an audit record. A failure to write the trail must not undo a business action that already succeeded,
   * so it is logged as an error instead of thrown (monitor for "Audit write failed").
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.logs.create({
        actorId: entry.actorId as never,
        actorRole: entry.actorRole,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        metadata: entry.metadata as Prisma.InputJsonObject | undefined,
      });
    } catch (error) {
      logger.error(`Audit write failed for ${entry.action}`, { message: (error as Error).message });
    }
  }

  /** Use case (supporting) "audit log" for Super admin. */
  async list(query: ListAuditQuery): Promise<Page<AuditLogDto>> {
    const { page, limit, ...filter } = query;
    const { items, total } = await this.logs.list(filter, { page, limit });
    return buildPage(items.map(toAuditLogDto), total, { page, limit });
  }
}

export const auditService = new AuditService();
