import { randomUUID } from 'node:crypto';
import { isUniqueViolation } from '../../config/database';
import { createImageUploadSignature, imagePublicId, verifyImageUpload } from '../../integrations/cloudinary';
import { BOOKING_STATUS, containsProfanity, PROFANITY_ERROR_MESSAGE, type PersistedRole } from '@travel-platform/constants';
import { AppError, ERROR_CODES } from '../../utils/app-error';
import { buildPage, type Page } from '../../utils/pagination';
import { assertTransition } from '../../utils/state-machine';
import { AUDIT_ACTIONS, auditService, type AuditService } from '../audit';
import { bookingsService, type BookingsService } from '../bookings';
import { NOTIFICATION_TYPE, notificationsService, type NotificationsService } from '../notifications';
import { toursService, type ToursService } from '../tours';
import { usersService, type UsersService } from '../users';
import { toModerationReviewDto, toMyReviewDto, toPublicReviewDto, type ReviewNames } from './reviews.mapper';
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
  type ReviewFacts,
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
  private async reviewableBooking(travelerId: string, bookingId: string) {
    const booking = await this.bookings.getFacts(bookingId);
    if (!booking || booking.travelerId !== travelerId) throw AppError.notFound('Booking not found');
    if (booking.status !== BOOKING_STATUS.COMPLETED) {
      throw AppError.conflict('You can review a trip after it is completed', 'BOOKING_NOT_COMPLETED');
    }
    if (await this.reviews.findByBookingId(booking.id)) {
      throw AppError.conflict('You already reviewed this booking', 'REVIEW_EXISTS');
    }
    return booking;
  }

  async createImageSignature(travelerId: string, bookingId: string) {
    await this.reviewableBooking(travelerId, bookingId);
    return createImageUploadSignature('reviewImage', `${travelerId}/${bookingId}/${randomUUID()}`);
  }

  async createReview(travelerId: string, input: CreateReviewInput): Promise<MyReviewDto> {
    const booking = await this.reviewableBooking(travelerId, input.bookingId);
    if (containsProfanity(input.comment)) {
      throw AppError.badRequest(PROFANITY_ERROR_MESSAGE, undefined, ERROR_CODES.PROFANITY_DETECTED);
    }
    const ids = input.imagePublicIds ?? [];
    if (ids.length > 6 || new Set(ids).size !== ids.length) throw AppError.badRequest('Maximum 6 unique review images');
    const prefix = `${imagePublicId('reviewImage', `${travelerId}/${booking.id}`)}/`;
    // Reject foreign assets before contacting the storage provider. Client URLs are never trusted.
    if (ids.some(id => !id.startsWith(prefix) || !/^[0-9a-f-]{36}$/i.test(id.slice(prefix.length)))) {
      throw AppError.forbidden('Review images must belong to this booking and traveler');
    }
    const images: string[] = [];
    for (const id of ids) {
      const asset = await verifyImageUpload('reviewImage', id.slice('tripin/reviews/'.length), id);
      images.push(asset.secureUrl);
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
        images,
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

  /** Use case "View public review" (Guest): VISIBLE reviews scoped to a tour, agency or guide; the author is masked. */
  async listPublic(query: ListPublicReviewsQuery): Promise<Page<PublicReviewDto>> {
    const { items, total } = await this.reviews.listPublic(query);
    const authors = await this.users.getSummaries(items.map((review) => review.travelerId));
    return buildPage(
      items.map((review) => toPublicReviewDto(review, authors.get(review.travelerId))),
      total,
      query,
    );
  }

  /** Minimal facts for other modules (e.g. a report about a review, or an agency disputing one). Null when it does not exist. */
  async getFacts(reviewId: string): Promise<ReviewFacts | null> {
    const review = await this.reviews.findById(reviewId);
    return review
      ? {
          id: review.id,
          tourId: review.tourId,
          agencyId: review.agencyId,
          travelerId: review.travelerId,
          status: review.status as ReviewStatus,
          rating: review.rating,
          comment: review.comment,
          tourTitle: review.tourTitle,
          hiddenReason: review.hiddenReason ?? undefined,
        }
      : null;
  }

  // ======================================================= Moderation

  /** Called by `moderation` for "Moderate reviews" (list). */
  async listForModeration(query: ListModerationReviewsQuery): Promise<Page<ModerationReviewDto>> {
    const { items, total } = await this.reviews.listForModeration(query);
    const names = await this.namesFor(items);
    return buildPage(items.map((review) => toModerationReviewDto(review, names.get(review.id))), total, query);
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
    return toModerationReviewDto(updated, (await this.namesFor([updated])).get(updated.id));
  }

  /** Reviews per status (dashboards). */
  async countByStatus(): Promise<Record<string, number>> {
    const rows = await this.reviews.countByStatus();
    return Object.fromEntries(rows.map((row) => [row.status, row.count]));
  }

  // ============================================================ helpers

  /** Display names of a page of reviews (author + agency), so the moderator queue shows no raw ids. */
  private async namesFor(items: ReviewRecord[]): Promise<Map<string, ReviewNames>> {
    const people = await this.users.getSummaries(items.flatMap((review) => [review.travelerId, review.agencyId]));
    return new Map(
      items.map((review) => {
        const agency = people.get(review.agencyId);
        return [
          review.id,
          {
            travelerName: people.get(review.travelerId)?.fullName,
            agencyName: agency ? (agency.companyName ?? agency.fullName) : undefined,
          },
        ];
      }),
    );
  }

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
