import type { RequestHandler } from 'express';
import { validated } from '../../middlewares/validate';
import { sendPaginated } from '../../utils/api-response';
import { auditService, type AuditService } from './audit.service';
import type { AuditAction } from './audit.types';
import type { ListAuditQueryInput } from './audit.validation';

export class AuditController {
  constructor(private readonly service: AuditService = auditService) {}

  list: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, ListAuditQueryInput>(req);
    const page = await this.service.list({ ...query, action: query.action as AuditAction | undefined });
    sendPaginated(res, page.items, page.meta);
  };
}

export const auditController = new AuditController();
