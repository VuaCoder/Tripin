import type { RequestHandler } from 'express';
import { userActor } from '../../middlewares/authorize';
import { validated } from '../../middlewares/validate';
import { sendCreated, sendPaginated } from '../../utils/api-response';
import { reviewsService, type ReviewsService } from './reviews.service';
import type { ReviewSort } from './reviews.types';
import type { CreateReviewBody, ListMyReviewsQueryInput, ListPublicReviewsQueryInput } from './reviews.validation';

/** HTTP only. The author is the authenticated traveler; tour and agency come from the booking. */
export class ReviewsController {
  constructor(private readonly service: ReviewsService = reviewsService) {}

  create: RequestHandler = async (req, res) => {
    const { body } = validated<CreateReviewBody>(req);
    sendCreated(res, await this.service.createReview(userActor(req).userId, body));
  };

  listPublic: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, ListPublicReviewsQueryInput>(req);
    const page = await this.service.listPublic({ ...query, sort: query.sort as ReviewSort });
    sendPaginated(res, page.items, page.meta);
  };

  listMine: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, ListMyReviewsQueryInput>(req);
    const page = await this.service.listMine(userActor(req).userId, query);
    sendPaginated(res, page.items, page.meta);
  };
}

export const reviewsController = new ReviewsController();
