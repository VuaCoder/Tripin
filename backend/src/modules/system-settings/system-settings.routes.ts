import { Router } from 'express';
import { PERMISSIONS } from '@travel-platform/constants';
import { requirePermission } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { systemSettingsController } from './system-settings.controller';
import { commissionBody, policyBody, policyKeyParams } from './system-settings.validation';

/** Mounted at /api/v1/policies — public (GUEST) read of policy texts. */
export const publicPoliciesRouter = Router();
publicPoliciesRouter.get('/', systemSettingsController.listPolicies);
publicPoliciesRouter.get('/:key', validate({ params: policyKeyParams }), systemSettingsController.getPolicy);

/** Mounted at /api/v1/admin/settings — SUPER_ADMIN. */
export const adminSettingsRouter = Router();
adminSettingsRouter.get('/commission', requirePermission(PERMISSIONS.COMMISSION_CONFIGURE), systemSettingsController.getCommission);
adminSettingsRouter.put(
  '/commission',
  requirePermission(PERMISSIONS.COMMISSION_CONFIGURE),
  validate({ body: commissionBody }),
  systemSettingsController.setCommission,
);

/** Mounted at /api/v1/admin/policies — SUPER_ADMIN. */
export const adminPoliciesRouter = Router();
adminPoliciesRouter.put(
  '/:key',
  requirePermission(PERMISSIONS.POLICY_CONFIGURE),
  validate({ params: policyKeyParams, body: policyBody }),
  systemSettingsController.setPolicy,
);
