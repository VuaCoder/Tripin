import { Router } from 'express';
import { PERMISSIONS } from '@travel-platform/constants';
import { requirePermission, requireSuperAdmin } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { auditController } from './audit.controller';
import { listAuditQuery } from './audit.validation';

/** Mounted at /api/v1/admin/audit-logs — read only (the trail is append-only by design). */
export const auditRouter = Router();
auditRouter.use(requireSuperAdmin);
auditRouter.get('/', requirePermission(PERMISSIONS.AUDIT_LOG_VIEW), validate({ query: listAuditQuery }), auditController.list);
