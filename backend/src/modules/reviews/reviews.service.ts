import { isUniqueViolation } from '../../config/database';
import { BOOKING_STATUS, type PersistedRole } from '@travel-platform/constants';
import { AppError } from '../../utils/app-error';
import { buildPage, type Page } from '../../utils/pagination';
import { assertTransition } from '../../utils/state-machine';
import { AUDIT_ACTIONS, auditService, type AuditService } from '../audit';
import { bookingsService, type BookingsService } from '../bookings';
import { NOTIFICATION_TYPE, notificationsService, type NotificationsService } from '../notifications';
import { toursService, type ToursService } from '../tours';
import { usersService, type UsersService } from '../users';
import { toModerationReviewDto, toMyReviewDto, toPublicReviewDto } from './reviews.mapper';
import type { ReviewRecord } from './reviews.repository';
import { reviewsRepository, type ReviewsRepository } from './reviews.repository';
import {
  REVIEW_STATUS,
  REVIEW_TRANSITIONS,
  type CreateReviewInput,
  type ListModerationReviewsQuery,
  type ListPublicReviewsQuery,
  type ModerationReviewDto,
  type MyReviewDto,
  type PublicReviewDto,
  type ReviewStatus,
} from './reviews.types';

type Actor = { userId: string; role: PersistedRole };

export class ReviewsService {
  constructor(
    private readonly reviews: Pick<
      ReviewsRepository,
      'create' | 'findById' | 'findByBookingId' | 'transition' | 'listPublic' | 'listByTraveler' | 'listForModeration' | 'visibleStats' | 'countByStatus'
    > = reviewsRepository,
    private readonly bookings: Pick<BookingsService, 'getFacts'> = bookingsService,
    private readonly tours: Pick<ToursService, 'updateRatingStats'> = toursService,
    private readonly users: Pick<UsersService, 'getSummaries'> = usersService,
    private readonly notifications: Pick<NotificationsService, 'notify'> = notificationsService,
    private readonly audit: Pick<AuditService, 'record'> = auditService,
  ) {}

  // ================================================================ Traveler

  /**
   * Use case "Write a review". Only the traveler who made a COMPLETED booking can review it, once. The tour and agency
   * come from the booking, never from the client.
   */
  async createReview(travelerId: string, input: CreateReviewInput): Promise<MyReviewDto> {
    const booking = await this.bookings.getFacts(input.bookingId);
    if (!booking || booking.travelerId !== travelerId) throw AppError.notFound('Booking not found');
    if (booking.status !== BOOKING_STATUS.COMPLETED) {
      throw AppError.conflict('You can review a trip after it is completed', 'BOOKING_NOT_COMPLETED');
    }
    if (await this.reviews.findByBookingId(booking.id)) {
      throw AppError.conflict('You already reviewed this booking', 'REVIEW_EXISTS');
    }

    let review: ReviewRecord;
    try {
      review = await this.reviews.create({
        bookingId: booking.id,
        tourId: booking.tourId,
        tourTitle: booking.tourTitle,
        agencyId: booking.agencyId,
        travelerId: travelerId,
        rating: input.rating,
        comment: input.comment,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw AppError.conflict('You already reviewed this booking', 'REVIEW_EXISTS');
      }
      throw error;
    }

    await this.refreshTourRating(booking.tourId);
    await this.notifications.notify(booking.agencyId, {
      type: NOTIFICATION_TYPE.REVIEW_RECEIVED,
      title: 'New review',
      body: `A traveler rated "${booking.tourTitle}" ${input.rating}/5.`,
      data: { tourId: booking.tourId, reviewId: review.id },
    });
    return toMyReviewDto(review);
  }

  /** Use case "View reviews" (Traveler): everything I wrote, including hidden ones. */
  async listMine(travelerId: string, page: { page: number; limit: number }): Promise<Page<MyReviewDto>> {
    const { items, total } = await this.reviews.listByTraveler(travelerId, page);
    return buildPage(items.map(toMyReviewDto), total, page);
  }

  // ============================================================= Public

  /** Use case "View public review" (Guest): VISIBLE reviews of a tour or an agency; the author is masked. */
  async listPublic(query: ListPublicReviewsQuery): Promise<Page<PublicReviewDto>> {
    const { items, total } = await this.reviews.listPublic(query);
    const authors = await this.users.getSummaries(items.map((review) => review.travelerId));
    return buildPage(
      items.map((review) => toPublicReviewDto(review, authors.get(review.travelerId))),
      total,
      query,
    );
  }

  /** Minimal facts for other modules (e.g. reports about a review). Null when it does not exist. */
  async getFacts(reviewId: string): Promise<{ id: string; tourId: string; agencyId: string; travelerId: string; status: ReviewStatus } | null> {
    const review = await this.reviews.findById(reviewId);
    return review
      ? { id: review.id, tourId: review.tourId, agencyId: review.agencyId, travelerId: review.travelerId, status: review.status as ReviewStatus }
      : null;
  }

  // ======================================================= Moderation

  /** Called by `moderation` for "Moderate reviews" (list). */
  async listForModeration(query: ListModerationReviewsQuery): Promise<Page<ModerationReviewDto>> {
    const { items, total } = await this.reviews.listForModeration(query);
    return buildPage(items.map(toModerationReviewDto), total, query);
  }

  /** Called by `moderation`: hide (reason required) or restore a review; the tour rating is recomputed. */
  async moderate(actor: Actor, reviewId: string, decision: { hide: boolean; reason?: string }): Promise<ModerationReviewDto> {
    if (decision.hide && !decision.reason) throw AppError.badRequest('A reason is required to hide a review');
    const review = await this.reviews.findById(reviewId);
    if (!review) throw AppError.notFound('Review not found');

    const next: ReviewStatus = decision.hide ? REVIEW_STATUS.HIDDEN : REVIEW_STATUS.VISIBLE;
    assertTransition(REVIEW_TRANSITIONS, review.status as ReviewStatus, next, 'Review');

    const updated = await this.reviews.transition(reviewId, review.status as ReviewStatus, {
      status: next,
      moderatedById: actor.userId,
      moderatedAt: new Date(),
      hiddenReason: decision.hide ? decision.reason : null,
    });
    if (!updated) throw AppError.conflict('The review was modified, please retry', 'CONCURRENT_UPDATE');

    await this.refreshTourRating(review.tourId);
    await this.audit.record({
      actorId: actor.userId,
      actorRole: actor.role,
      action: AUDIT_ACTIONS.REVIEW_MODERATED,
      targetType: 'review',
      targetId: reviewId,
      metadata: { hidden: decision.hide, reason: decision.reason },
    });
    await this.notifications.notify(review.travelerId, {
      type: NOTIFICATION_TYPE.REVIEW_MODERATED,
      title: decision.hide ? 'Your review was hidden' : 'Your review was restored',
      body: decision.hide ? `Your review of "${review.tourTitle}" was hidden: ${decision.reason}` : `Your review of "${review.tourTitle}" is visible again.`,
      data: { reviewId },
    });
    return toModerationReviewDto(updated);
  }

  /** Reviews per status (dashboards). */
  async countByStatus(): Promise<Record<string, number>> {
    const rows = await this.reviews.countByStatus();
    return Object.fromEntries(rows.map((row) => [row.status, row.count]));
  }

  // ============================================================ helpers

  /**
   * Recomputes the tour's average/count from VISIBLE reviews only (2 decimals). Two reviews written at the same moment
   * could each store a stale result, so the statistic is read again after writing and rewritten until it is stable.
   */
  private async refreshTourRating(tourId: string): Promise<void> {
    let written: { avg: number; count: number } | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { avg, count } = await this.reviews.visibleStats(tourId);
      const rounded = Math.round(avg * 100) / 100;
      if (written && written.avg === rounded && written.count === count) return;
      await this.tours.updateRatingStats(tourId, rounded, count);
      written = { avg: rounded, count };
    }
  }
}

export const reviewsService = new ReviewsService();
