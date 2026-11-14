import { z } from 'zod';
import { PERSISTED_ROLES } from '@travel-platform/constants';
import { paginationQuerySchema } from '../../utils/pagination';
import { idSchema } from '../../utils/id';
import { AUDIT_ACTIONS } from './audit.types';

export const listAuditQuery = paginationQuerySchema
  .extend({
    actorId: idSchema.optional(),
    actorRole: z.enum(PERSISTED_ROLES).optional(),
    action: z.enum(Object.values(AUDIT_ACTIONS) as [string, ...string[]]).optional(),
    targetType: z.string().trim().min(1).max(60).optional(),
    targetId: z.string().trim().min(1).max(60).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    order: z.enum(['asc', 'desc']).optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: '`from` must not be after `to`', path: ['from'] });

export type ListAuditQueryInput = z.infer<typeof listAuditQuery>;
