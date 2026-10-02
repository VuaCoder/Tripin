import { prisma, type Prisma } from '../../config/database';
import type { AuditLog } from '../../generated/prisma/client';
import { toSkip, type PageRequest } from '../../utils/pagination';
import type { ListAuditQuery } from './audit.types';

export type AuditLogRecord = AuditLog;

export class AuditRepository {
  create(data: Prisma.AuditLogUncheckedCreateInput): Promise<AuditLogRecord> {
    return prisma.auditLog.create({ data });
  }

  async list(filter: Omit<ListAuditQuery, keyof PageRequest>, page: PageRequest) {
    const where: Prisma.AuditLogWhereInput = {};
    if (filter.actorId) where.actorId = filter.actorId;
    if (filter.action) where.action = filter.action;
    if (filter.targetType) where.targetType = filter.targetType;
    if (filter.targetId) where.targetId = filter.targetId;
    if (filter.from || filter.to) {
      where.createdAt = { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) };
    }
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: toSkip(page), take: page.limit }),
      prisma.auditLog.count({ where }),
    ]);
    return { items, total };
  }
}

export const auditRepository = new AuditRepository();
