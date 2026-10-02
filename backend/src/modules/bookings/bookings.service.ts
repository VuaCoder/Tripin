import { BOOKING_CANCEL_REASON, BOOKING_STATUS, type BookingCancelReason, type BookingStatus } from '@travel-platform/constants';
import { isUniqueViolation } from '../../config/database';
import { AppError } from '../../utils/app-error';
import { randomInt } from 'node:crypto';
import { buildPage, type Page } from '../../utils/pagination';
import { assertTransition } from '../../utils/state-machine';
import { logger } from '../../utils/logger';
import { NOTIFICATION_TYPE, notificationsService, type NotificationsService } from '../notifications';
import { promotionsService, type PromotionsService, type AppliedPromotion } from '../promotions';
import { systemSettingsService, type SystemSettingsService } from '../system-settings';
import { toursService, type ToursService } from '../tours';
import { bookingEvents } from './bookings.events';
import { toAgencyBookingDto, toBookingDto, toBookingFacts } from './bookings.mapper';
import { BOOKING_POLICY, BOOKING_TRANSITIONS } from './bookings.policy';
import { bookingsRepository, type BookingRecord, type BookingsRepository, type NewBooking } from './bookings.repository';
import { CUSTOMER_EXPORT_LIMIT, type CustomerRow } from './bookings.types';
import type {
  AgencyBookingDto,
  AgencyBookingStats,
  PlatformBookingStats,
  BookingDto,
  BookingFacts,
  CreateBookingInput,
  ListAgencyBookingsQuery,
  ListBookingsQuery,
  PayableBooking,
  PaymentConfirmationOutcome,
} from './bookings.types';

const ENTITY = 'Booking';
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

type Repo = Pick<
  BookingsRepository,
  | 'create' | 'findById' | 'findByRequestId' | 'transition' | 'updateById' | 'listByTraveler' | 'listByAgency'
  | 'findExpiredPending' | 'findDueForCompletion' | 'statusCounts' | 'revenueTotals' | 'dailyNet' | 'monthlyTotals' | 'topTours' | 'listPaidForTour'
>;

const AMOUNT_TOO_LOW = () =>
  AppError.conflict('The amount to pay must be at least 1 VND: this tour or promotion cannot be booked online', 'BOOKING_AMOUNT_TOO_LOW');

export class BookingsService {
  constructor(
    private readonly bookings: Repo = bookingsRepository,
    private readonly tours: Pick<ToursService, 'getBookableDeparture' | 'reserveSeats' | 'releaseSeats' | 'getTourFacts'> = toursService,
    private readonly promotions: Pick<PromotionsService, 'redeem' | 'release'> = promotionsService,
    private readonly settings: Pick<SystemSettingsService, 'getCommissionBps' | 'getPolicyNumber'> = systemSettingsService,
    private readonly notifications: Pick<NotificationsService, 'notify'> = notificationsService,
  ) {}

  // ============================================================== Traveler

  /**
   * Use case "Book tour". Price, discount and commission are computed here from server data only — the client sends
   * ids and a head-count. Steps (with compensation on failure): reserve seats (atomic) -> redeem promotion (atomic)
   * -> persist. `clientRequestId` makes the call safe to retry.
   */
  async createBooking(travelerId: string, input: CreateBookingInput): Promise<BookingDto> {
    try {
      return await this.createBookingOnce(travelerId, input);
    } catch (error) {
      // A parallel retry of the same request (same clientRequestId) may have just taken the last seats. For THAT key
      // this is not a failure: hand back the winner's booking. The winner may not have stored it yet, so look a few
      // times (bounded, ~120 ms) before reporting the original error.
      const seatsGone = error instanceof AppError && error.statusCode === 409 && ['NOT_ENOUGH_SEATS', 'DEPARTURE_UNAVAILABLE'].includes(error.code);
      for (let attempt = 0; seatsGone && input.clientRequestId && attempt < 4; attempt += 1) {
        const duplicate = await this.bookings.findByRequestId(travelerId, input.clientRequestId);
        if (duplicate) return toBookingDto(duplicate);
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      throw error;
    }
  }

  private async createBookingOnce(travelerId: string, input: CreateBookingInput): Promise<BookingDto> {
    if (input.clientRequestId) {
      const duplicate = await this.bookings.findByRequestId(travelerId, input.clientRequestId);
      if (duplicate) return toBookingDto(duplicate);
    }

    const departure = await this.tours.getBookableDeparture(input.tourId, input.departureId);
    if (input.participants > departure.remaining) {
      throw AppError.conflict('Not enough seats left on this departure', 'NOT_ENOUGH_SEATS');
    }
    const subtotal = departure.unitPrice * input.participants;
    if (subtotal < BOOKING_POLICY.MIN_PAYABLE_AMOUNT) throw AMOUNT_TOO_LOW();

    await this.tours.reserveSeats(input.tourId, input.departureId, input.participants);
    let applied: AppliedPromotion | undefined;
    try {
      if (input.promotionCode) applied = await this.promotions.redeem(input.promotionCode, input.tourId, subtotal);

      const discountAmount = applied?.discountAmount ?? 0;
      const totalAmount = subtotal - discountAmount;
      // A promotion that would make the order free cannot be paid online (no free-booking flow exists): refuse, seats and redemption are given back.
      if (totalAmount < BOOKING_POLICY.MIN_PAYABLE_AMOUNT) throw AMOUNT_TOO_LOW();
      const commissionBps = await this.settings.getCommissionBps();
      const commissionAmount = Math.floor((totalAmount * commissionBps) / 10_000);

      const created = await this.createWithUniqueCode({
        travelerId,
        agencyId: departure.agencyId,
        tourId: input.tourId,
        departureId: input.departureId,
        tourTitle: departure.title,
        departureDate: departure.departureDate,
        endDate: new Date(departure.departureDate.getTime() + departure.durationDays * DAY_MS),
        participants: input.participants,
        contact: input.contact,
        notes: input.notes,
        unitPrice: departure.unitPrice,
        subtotal,
        promotion: applied ? { promotionId: applied.promotionId, code: applied.code, scope: applied.scope, discountAmount } : undefined,
        discountAmount,
        totalAmount,
        commissionBps,
        commissionAmount,
        agencyAmount: totalAmount - commissionAmount,
        status: BOOKING_STATUS.PENDING,
        paymentExpiresAt: new Date(Date.now() + BOOKING_POLICY.PENDING_PAYMENT_MINUTES * MINUTE_MS),
        clientRequestId: input.clientRequestId,
      });

      await this.notifications.notify(travelerId, {
        type: NOTIFICATION_TYPE.BOOKING_CREATED,
        title: 'Booking created',
        body: `Your booking ${created.bookingCode} for "${created.tourTitle}" is waiting for payment (${BOOKING_POLICY.PENDING_PAYMENT_MINUTES} minutes).`,
        data: { bookingId: created.id },
      });
      return toBookingDto(created);
    } catch (error) {
      await this.compensate(input, applied);
      // Lost a race on the retry key: the other request created the booking, return it.
      if (input.clientRequestId && isDuplicateKey(error, 'clientRequestId')) {
        const existing = await this.bookings.findByRequestId(travelerId, input.clientRequestId);
        if (existing) return toBookingDto(existing);
      }
      throw error;
    }
  }

  async listMine(travelerId: string, query: ListBookingsQuery): Promise<Page<BookingDto>> {
    const { items, total } = await this.bookings.listByTraveler(travelerId, query.status, query);
    return buildPage(items.map(toBookingDto), total, query);
  }

  async getMine(travelerId: string, id: string): Promise<BookingDto> {
    return toBookingDto(await this.requireOwnedByTraveler(travelerId, id));
  }

  /**
   * Cancel as the traveler. PENDING: any time. CONFIRMED: only while the departure is further away than the
   * `cancellation.cancellationWindowHours` policy; a paid booking is flagged `refundRequired`.
   */
  async cancelMine(travelerId: string, id: string, note?: string): Promise<BookingDto> {
    const booking = await this.requireOwnedByTraveler(travelerId, id);
    assertTransition(BOOKING_TRANSITIONS, booking.status as BookingStatus, BOOKING_STATUS.CANCELLED, ENTITY);

    if (booking.status === BOOKING_STATUS.CONFIRMED) {
      const windowHours = (await this.settings.getPolicyNumber('cancellation', 'cancellationWindowHours')) ?? 24;
      const hoursLeft = (booking.departureDate.getTime() - Date.now()) / (60 * MINUTE_MS);
      if (hoursLeft < windowHours) {
        throw AppError.conflict(
          `A confirmed booking can only be cancelled more than ${windowHours} hours before departure`,
          'CANCELLATION_WINDOW_PASSED',
        );
      }
    }

    // Compare-and-set on the status the rules above were checked against (a payment landing meanwhile must not slip through).
    const cancelled = await this.cancelInternal(booking, BOOKING_CANCEL_REASON.TRAVELER_REQUEST, [booking.status as BookingStatus], note);
    if (!cancelled) throw AppError.conflict('The booking changed, please retry', 'CONCURRENT_UPDATE');

    await this.notifications.notify(booking.agencyId, {
      type: NOTIFICATION_TYPE.BOOKING_CANCELLED,
      title: 'A booking was cancelled',
      body: `Booking ${booking.bookingCode} for "${booking.tourTitle}" was cancelled by the traveler.`,
      data: { bookingId: booking.id },
    });
    return toBookingDto(cancelled);
  }

  // ================================================================ Agency

  /** Use case "View bookings status". */
  async listForAgency(agencyId: string, query: ListAgencyBookingsQuery): Promise<Page<AgencyBookingDto>> {
    const { items, total } = await this.bookings.listByAgency(agencyId, query);
    return buildPage(items.map(toAgencyBookingDto), total, query);
  }

  async getForAgency(agencyId: string, id: string): Promise<AgencyBookingDto> {
    const booking = await this.bookings.findById(id);
    if (!booking || booking.agencyId !== agencyId) throw AppError.notFound('Booking not found');
    return toAgencyBookingDto(booking);
  }

  // ====================================================== Used by payments

  /** The booking a traveler is about to pay: must be theirs, PENDING and still inside the payment window. */
  async getPayable(travelerId: string, bookingId: string): Promise<PayableBooking> {
    const booking = await this.requireOwnedByTraveler(travelerId, bookingId);
    if (booking.status !== BOOKING_STATUS.PENDING) {
      throw AppError.conflict(`A booking in status ${booking.status} cannot be paid`, 'BOOKING_NOT_PAYABLE');
    }
    if (!booking.paymentExpiresAt || booking.paymentExpiresAt.getTime() <= Date.now()) {
      throw AppError.conflict('The payment window of this booking has expired', 'BOOKING_PAYMENT_EXPIRED');
    }
    return {
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
      description: booking.bookingCode,
      amount: booking.totalAmount,
      expiresAt: booking.paymentExpiresAt,
    };
  }

  /**
   * Called by `payments` after a payment has been verified server-side. Idempotent. A payment that arrives after the
   * booking was cancelled/expired cannot revive it: the booking is flagged `refundRequired` instead.
   */
  async confirmPayment(bookingId: string): Promise<{ outcome: PaymentConfirmationOutcome; booking: BookingFacts }> {
    const booking = await this.bookings.findById(bookingId);
    if (!booking) throw AppError.notFound('Booking not found');

    if (booking.status === BOOKING_STATUS.CONFIRMED || booking.status === BOOKING_STATUS.COMPLETED) {
      return { outcome: 'ALREADY_CONFIRMED', booking: toBookingFacts(booking) };
    }
    if (booking.status === BOOKING_STATUS.CANCELLED) {
      const flagged = await this.bookings.updateById(bookingId, { isPaid: true, refundRequired: true });
      return { outcome: 'REFUND_REQUIRED', booking: toBookingFacts(flagged ?? booking) };
    }

    const confirmed = await this.bookings.transition(bookingId, [BOOKING_STATUS.PENDING], {
      status: BOOKING_STATUS.CONFIRMED,
      isPaid: true,
      confirmedAt: new Date(),
      paymentExpiresAt: null,
    });
    if (!confirmed) return this.confirmPayment(bookingId); // state moved under us: re-evaluate once more

    const facts = toBookingFacts(confirmed);
    await Promise.all([
      this.notifications.notify(facts.travelerId, {
        type: NOTIFICATION_TYPE.BOOKING_CONFIRMED,
        title: 'Booking confirmed',
        body: `Payment received. Your booking ${facts.bookingCode} for "${facts.tourTitle}" is confirmed.`,
        data: { bookingId: facts.id },
      }),
      this.notifications.notify(facts.agencyId, {
        type: NOTIFICATION_TYPE.BOOKING_CONFIRMED,
        title: 'New confirmed booking',
        body: `${facts.participants} traveler(s) booked "${facts.tourTitle}" (${facts.bookingCode}).`,
        data: { bookingId: facts.id },
      }),
    ]);
    await bookingEvents.emitConfirmed(facts);
    return { outcome: 'CONFIRMED', booking: facts };
  }

  /** Facts for other modules (e-tickets, reviews, earnings). Null when the booking does not exist. */
  async getFacts(bookingId: string): Promise<BookingFacts | null> {
    const booking = await this.bookings.findById(bookingId);
    return booking ? toBookingFacts(booking) : null;
  }

  // ========================================================== Maintenance

  /** Cancels PENDING bookings whose payment window passed and gives their seats/promotions back. Returns the count. */
  async expirePendingBookings(now = new Date()): Promise<number> {
    const due = await this.bookings.findExpiredPending(now, BOOKING_POLICY.MAINTENANCE_BATCH);
    let expired = 0;
    for (const booking of due) {
      try {
        // Only a still-PENDING booking may expire: if the payment confirmed it a moment ago it must stay CONFIRMED.
        if (await this.cancelInternal(booking, BOOKING_CANCEL_REASON.PAYMENT_EXPIRED, [BOOKING_STATUS.PENDING])) {
          expired += 1;
          await this.notifications.notify(booking.travelerId, {
            type: NOTIFICATION_TYPE.BOOKING_CANCELLED,
            title: 'Booking expired',
            body: `Booking ${booking.bookingCode} was cancelled because it was not paid in time.`,
            data: { bookingId: booking.id },
          });
        }
      } catch (error) {
        logger.error(`Could not expire booking ${booking.bookingCode}`, { message: (error as Error).message });
      }
    }
    return expired;
  }

  /** CONFIRMED -> COMPLETED for tours that have ended; emits `completed` for earnings / reviews. Returns the count. */
  async completeFinishedBookings(now = new Date()): Promise<number> {
    const due = await this.bookings.findDueForCompletion(now, BOOKING_POLICY.MAINTENANCE_BATCH);
    let completed = 0;
    for (const booking of due) {
      try {
        const done = await this.bookings.transition(booking.id, [BOOKING_STATUS.CONFIRMED], {
          status: BOOKING_STATUS.COMPLETED,
          completedAt: new Date(),
        });
        if (!done) continue;
        completed += 1;
        const facts = toBookingFacts(done);
        await this.notifications.notify(facts.travelerId, {
          type: NOTIFICATION_TYPE.BOOKING_COMPLETED,
          title: 'How was your trip?',
          body: `Your trip "${facts.tourTitle}" is over. Share your experience with a review.`,
          data: { bookingId: facts.id, tourId: facts.tourId },
        });
        await bookingEvents.emitCompleted(facts);
      } catch (error) {
        logger.error(`Could not complete booking ${booking.bookingCode}`, { message: (error as Error).message });
      }
    }
    return completed;
  }

  // ======================================================= Customer export

  /**
   * Data for "Export customer PDF": paid bookings of one of the agency's tours (optionally one departure).
   * The tour must belong to the agency (404 otherwise). The list is capped; `truncated` says when it was cut.
   */
  async listCustomers(agencyId: string, tourId: string, departureId?: string): Promise<{ tourTitle: string; rows: CustomerRow[]; truncated: boolean }> {
    const tour = await this.tours.getTourFacts(tourId);
    if (!tour || tour.agencyId !== agencyId) throw AppError.notFound('Tour not found');

    const bookings = await this.bookings.listPaidForTour(agencyId, tourId, departureId, CUSTOMER_EXPORT_LIMIT + 1);
    const rows = bookings.slice(0, CUSTOMER_EXPORT_LIMIT).map((booking) => ({
      bookingCode: booking.bookingCode,
      departureDate: booking.departureDate,
      travelerName: booking.contact.fullName,
      phone: booking.contact.phone,
      participants: booking.participants,
      notes: booking.notes ?? undefined,
    }));
    return { tourTitle: tour.title, rows, truncated: bookings.length > CUSTOMER_EXPORT_LIMIT };
  }

  // ======================================================== Dashboard stats

  /** Read model for the agency dashboard (its own bookings only). */
  async getAgencyStats(agencyId: string, now = new Date()): Promise<AgencyBookingStats> {
    const since = new Date(now.getTime() - 30 * DAY_MS);
    const [byStatus, totals, last30Days, topTours] = await Promise.all([
      this.bookings.statusCounts(agencyId),
      this.bookings.revenueTotals(agencyId),
      this.bookings.dailyNet(agencyId, since),
      this.bookings.topTours(agencyId, 5),
    ]);
    return { byStatus, totals, last30Days, topTours };
  }

  /** Read model for the super-admin dashboard (whole platform). */
  async getPlatformStats(now = new Date()): Promise<PlatformBookingStats> {
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
    const [byStatus, totals, monthly] = await Promise.all([
      this.bookings.statusCounts(),
      this.bookings.revenueTotals(),
      this.bookings.monthlyTotals(since),
    ]);
    return { byStatus, totals, monthly };
  }

  // ============================================================== helpers

  /** 404 (never 403) when the booking is not the traveler's own, so booking ids of others are not revealed. */
  private async requireOwnedByTraveler(travelerId: string, id: string): Promise<BookingRecord> {
    const booking = await this.bookings.findById(id);
    if (!booking || booking.travelerId !== travelerId) throw AppError.notFound('Booking not found');
    return booking;
  }

  /** CAS to CANCELLED, then give back seats and the promotion redemption. Null if someone else changed the booking. */
  private async cancelInternal(
    booking: BookingRecord,
    reason: BookingCancelReason,
    expected: readonly BookingStatus[],
    note?: string,
  ): Promise<BookingRecord | null> {
    const wasPaid = booking.isPaid;
    const cancelled = await this.bookings.transition(booking.id, expected, {
      status: BOOKING_STATUS.CANCELLED,
      cancelledAt: new Date(),
      cancelReason: reason,
      ...(note ? { cancelNote: note } : {}),
      ...(wasPaid ? { refundRequired: true } : {}),
      paymentExpiresAt: null,
    });
    if (!cancelled) return null;

    await this.tours.releaseSeats(booking.tourId, booking.departureId, booking.participants);
    if (booking.promotion) await this.promotions.release(booking.promotion.promotionId);
    await bookingEvents.emitCancelled(toBookingFacts(cancelled));
    return cancelled;
  }

  private async compensate(input: CreateBookingInput, applied?: AppliedPromotion): Promise<void> {
    try {
      await this.tours.releaseSeats(input.tourId, input.departureId, input.participants);
      if (applied) await this.promotions.release(applied.promotionId);
    } catch (error) {
      logger.error('Booking compensation failed (seats/promotion may need manual release)', { message: (error as Error).message });
    }
  }

  private async createWithUniqueCode(data: Omit<NewBooking, 'bookingCode'>): Promise<BookingRecord> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.bookings.create({ ...data, bookingCode: generateBookingCode() });
      } catch (error) {
        if (!isDuplicateKey(error, 'bookingCode') || attempt >= BOOKING_POLICY.CODE_MAX_ATTEMPTS) throw error;
      }
    }
  }
}

export function generateBookingCode(): string {
  const { CODE_ALPHABET, CODE_LENGTH, CODE_PREFIX } = BOOKING_POLICY;
  const body = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)]).join('');
  return `${CODE_PREFIX}-${body}`;
}

const isDuplicateKey = isUniqueViolation;

export const bookingsService = new BookingsService();
