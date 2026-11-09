import { randomUUID } from 'node:crypto';
import { reviewContentVersion } from './reviews.revision';
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
      'create' | 'findById' | 'findByBookingId' | 'transition' | 'listPublic' | 'listByTraveler' | 'listForModeration' | 'visibleStats' | 'countByStatus' | 'tourImagesFor'
    > = reviewsRepository,
    private readonly bookings: Pick<BookingsService, 'getFacts'> = bookingsService,
    _tours: Pick<ToursService, 'updateRatingStats'> = toursService,
    private readonly users: Pick<UsersService, 'getSummaries'> = usersService,
    private readonly notifications: Pick<NotificationsService, 'notify'> = notificationsService,
    _audit: Pick<AuditService, 'record'> = auditService,
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
    if (!booking.endDate || booking.endDate.getTime() > Date.now()) {
      throw AppError.conflict('Chuyến đi chưa kết thúc', 'TRIP_NOT_ENDED');
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
          contentVersion: reviewContentVersion(review),
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
  async moderate(actor: Actor, reviewId: string, decision: { hide: boolean; reason?: string; restorationReason?: string; contentVersion?: string }): Promise<ModerationReviewDto> {
    if (decision.hide && !decision.reason) throw AppError.badRequest('A reason is required to hide a review');
    if (!decision.hide && (!decision.restorationReason || decision.restorationReason.trim().length < 3 || decision.restorationReason.trim().length > 1000)) throw AppError.badRequest('A restorationReason is required to restore a review');
    const review = await this.reviews.findById(reviewId);
    if (!review) throw AppError.notFound('Review not found');
    if (decision.contentVersion !== reviewContentVersion(review)) throw AppError.conflict('Review content changed. Reload before deciding.', 'REVIEW_REVISION_CONFLICT');

    const next: ReviewStatus = decision.hide ? REVIEW_STATUS.HIDDEN : REVIEW_STATUS.VISIBLE;
    assertTransition(REVIEW_TRANSITIONS, review.status as ReviewStatus, next, 'Review');

    const updated = await this.reviews.transition(reviewId, review.status as ReviewStatus, {
      status: next,
      moderatedById: actor.userId,
      moderatedAt: new Date(),
      hiddenReason: decision.hide ? decision.reason : null,
    }, {
      actorId: actor.userId,
      actorRole: actor.role,
      action: AUDIT_ACTIONS.REVIEW_MODERATED,
      targetType: 'review',
      targetId: reviewId,
      metadata: { before: { status: review.status, hiddenReason: review.hiddenReason }, after: { status: next, hiddenReason: decision.hide ? decision.reason : null, moderatedById: actor.userId }, hidden: decision.hide, reason: decision.hide ? decision.reason : decision.restorationReason?.trim() },
    }, { comment: review.comment, rating: review.rating, images: review.images ?? [] });
    if (!updated) throw AppError.conflict('Review changed. Reload before deciding.', 'REVIEW_REVISION_CONFLICT');


    // Notification and email outbox were persisted by the same transaction as the decision.
    return toModerationReviewDto(updated, (await this.namesFor([updated])).get(updated.id));
  }

  /** Reviews per status (dashboards). */
  async countByStatus(): Promise<Record<string, number>> {
    const rows = await this.reviews.countByStatus();
    return Object.fromEntries(rows.map((row) => [row.status, row.count]));
  }

  // ============================================================ helpers

  /** Display names of a page of reviews (author + agency + tour image), so the moderator queue shows no raw ids. */
  private async namesFor(items: ReviewRecord[]): Promise<Map<string, ReviewNames>> {
    const [people, tourImages] = await Promise.all([
      this.users.getSummaries(items.flatMap((review) => [review.travelerId, review.agencyId])),
      this.reviews.tourImagesFor ? this.reviews.tourImagesFor(items.map((r) => r.tourId)) : Promise.resolve(new Map<string, string>()),
    ]);
    return new Map(
      items.map((review) => {
        const agency = people.get(review.agencyId);
        return [
          review.id,
          {
            travelerName: people.get(review.travelerId)?.fullName,
            agencyName: agency ? (agency.companyName ?? agency.fullName) : undefined,
            tourImage: tourImages.get(review.tourId) || undefined,
          },
        ];
      }),
    );
  }

}

export const reviewsService = new ReviewsService();
