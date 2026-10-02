import type { QueryFilter } from 'mongoose';
import { toSkip, type PageRequest } from '../../utils/pagination';
import { AuditLogModel, type AuditLogAttributes, type AuditLogDocument } from './audit.model';
import type { ListAuditQuery } from './audit.types';

export class AuditRepository {
  create(data: Partial<AuditLogAttributes>): Promise<AuditLogDocument> {
    return AuditLogModel.create(data);
  }

  async list(filter: Omit<ListAuditQuery, keyof PageRequest>, page: PageRequest) {
    const query: QueryFilter<AuditLogAttributes> = {};
    if (filter.actorId) query.actorId = filter.actorId;
    if (filter.action) query.action = filter.action;
    if (filter.targetType) query.targetType = filter.targetType;
    if (filter.targetId) query.targetId = filter.targetId;
    if (filter.from || filter.to) {
      query.createdAt = { ...(filter.from ? { $gte: filter.from } : {}), ...(filter.to ? { $lte: filter.to } : {}) };
    }
    const [items, total] = await Promise.all([
      AuditLogModel.find(query).sort({ createdAt: -1 }).skip(toSkip(page)).limit(page.limit).exec(),
      AuditLogModel.countDocuments(query).exec(),
    ]);
    return { items, total };
  }
}

export const auditRepository = new AuditRepository();
