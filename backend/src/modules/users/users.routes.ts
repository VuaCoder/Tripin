import { Router } from 'express';
import { PERMISSIONS } from '@travel-platform/constants';
import { requirePermission } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { usersController } from './users.controller';
import {
  assignAccessBody,
  assignAccessParams,
  listUsersQuery,
  publicProfileParams,
  updateProfileBody,
} from './users.validation';

/** Mounted at /api/v1/users — the logged-in user's own profile. */
export const usersRouter = Router();
usersRouter.get('/me', requirePermission(PERMISSIONS.PROFILE_VIEW_OWN), usersController.getMe);
usersRouter.patch(
  '/me',
  requirePermission(PERMISSIONS.PROFILE_UPDATE_OWN),
  validate({ body: updateProfileBody }),
  usersController.updateMe,
);
usersRouter.post(
  '/me/agency-verification',
  requirePermission(PERMISSIONS.PROFILE_UPDATE_OWN),
  usersController.requestAgencyVerification,
);

/** Mounted at /api/v1/tour-guides — public (GUEST) profile. */
export const publicGuidesRouter = Router();
publicGuidesRouter.get('/:id', validate({ params: publicProfileParams }), usersController.getPublicGuide);

/** Mounted at /api/v1/agencies — public (GUEST) profile. */
export const publicAgenciesRouter = Router();
publicAgenciesRouter.get('/:id', validate({ params: publicProfileParams }), usersController.getPublicAgency);

/** Mounted at /api/v1/admin/users — SUPER_ADMIN access management. */
export const adminUsersRouter = Router();
adminUsersRouter.use(requirePermission(PERMISSIONS.USER_ASSIGN_PERMISSIONS));
adminUsersRouter.get('/', validate({ query: listUsersQuery }), usersController.listUsers);
adminUsersRouter.patch(
  '/:id/access',
  validate({ params: assignAccessParams, body: assignAccessBody }),
  usersController.assignAccess,
);
