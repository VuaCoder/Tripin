import { Router } from 'express';
import { PERMISSIONS } from '@travel-platform/constants';
import { requirePermission } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { reviewsController } from './reviews.controller';
import { createReviewBody, listMyReviewsQuery, listPublicReviewsQuery, reviewImageSignatureBody } from './reviews.validation';

/** Mounted at /api/v1/reviews */
export const reviewsRouter = Router();

// Public (GUEST): visible reviews of a tour, agency, or completed trips led by a guide.
reviewsRouter.get('/', validate({ query: listPublicReviewsQuery }), reviewsController.listPublic);
// '/me' is declared before any '/:id' style route.
reviewsRouter.get('/me', requirePermission(PERMISSIONS.REVIEW_CREATE), validate({ query: listMyReviewsQuery }), reviewsController.listMine);
reviewsRouter.post('/', requirePermission(PERMISSIONS.REVIEW_CREATE), validate({ body: createReviewBody }), reviewsController.create);
reviewsRouter.post('/images/upload-signature', requirePermission(PERMISSIONS.REVIEW_CREATE), validate({ body: reviewImageSignatureBody }), reviewsController.imageSignature);
