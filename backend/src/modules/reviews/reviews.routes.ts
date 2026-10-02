import { Router } from 'express';
import { PERMISSIONS } from '@travel-platform/constants';
import { requirePermission } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { reviewsController } from './reviews.controller';
import { createReviewBody, listMyReviewsQuery, listPublicReviewsQuery } from './reviews.validation';

/** Mounted at /api/v1/reviews */
export const reviewsRouter = Router();

// Public (GUEST): visible reviews of a tour or an agency.
reviewsRouter.get('/', validate({ query: listPublicReviewsQuery }), reviewsController.listPublic);
// '/me' is declared before any '/:id' style route.
reviewsRouter.get('/me', requirePermission(PERMISSIONS.REVIEW_CREATE), validate({ query: listMyReviewsQuery }), reviewsController.listMine);
reviewsRouter.post('/', requirePermission(PERMISSIONS.REVIEW_CREATE), validate({ body: createReviewBody }), reviewsController.create);
