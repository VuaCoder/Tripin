import { GUIDE_ASSIGNMENT_STATUS, ROLES, TOUR_STATUS, type PersistedRole, type TourStatus } from '@travel-platform/constants';
import { AppError } from '../../utils/app-error';
import { buildPage, type Page } from '../../utils/pagination';
import { assertTransition } from '../../utils/state-machine';
import { AUDIT_ACTIONS, auditService, type AuditService } from '../audit';
import { categoriesService, type CategoriesService } from '../categories';
import { NOTIFICATION_TYPE, notificationsService, type NotificationsService } from '../notifications';
import { usersService, type UsersService } from '../users';
import type { TourDocument } from './tours.model';
import { departurePrice, isBookable } from './tours.mapper';
import { toursRepository, type ToursRepository } from './tours.repository';
import {
  AGENCY_EDITABLE_STATUSES,
  GUIDE_ASSIGNMENT_TRANSITIONS,
  TOUR_TRANSITIONS,
  type BookableDeparture,
  type DepartureInput,
  type GuideTourDto,
  type ItineraryDayInput,
  type ListTourFilter,
  type TourContentInput,
  type TourManageDto,
  type UpdateTourInput,
} from './tours.types';
import { tourViewBuilder, type TourViewBuilder } from './tours.view';

type Actor = { userId: string; role: PersistedRole };
type Repo = Pick<
  ToursRepository,
  | 'create' | 'insertMany' | 'findById' | 'updateIfStatus' | 'answerGuideAssignment' | 'listByAgency' | 'listByGuide'
  | 'listForModeration' | 'reserveSeats' | 'releaseSeats' | 'replaceDeparturesIfVersion' | 'setRatingStats' | 'countByStatus'
>;

const ENTITY = 'Tour';

/**
 * Agency tour management, guide assignment answers, moderation decisions and the inventory API used by bookings.
 * Public discovery (search / details) lives in `ToursDiscoveryService`.
 */
export class ToursService {
  constructor(
    private readonly tours: Repo = toursRepository,
    private readonly users: Pick<UsersService, 'assertActiveWithRole' | 'assertAgencyVerified'> = usersService,
    private readonly categories: Pick<CategoriesService, 'assertActiveIds'> = categoriesService,
    private readonly audit: Pick<AuditService, 'record'> = auditService,
    private readonly views: Pick<TourViewBuilder, 'manage' | 'manageMany' | 'guideItems'> = tourViewBuilder,
    private readonly notifications: Pick<NotificationsService, 'notify'> = notificationsService,
  ) {}

  // ================================================================ Agency

  /** Use case "Create tour" — always starts as DRAFT. */
  async createTour(agencyId: string, input: TourContentInput): Promise<TourManageDto> {
    await this.categories.assertActiveIds(input.categoryIds);
    const created = await this.tours.create({ ...input, agencyId: agencyId as never, categoryIds: input.categoryIds as never });
    return this.views.manage(created);
  }

  /** Use case "Upload tours" (bulk import, DECISIONS D-11): all-or-nothing validation, every tour lands as DRAFT. */
  async importTours(agencyId: string, inputs: TourContentInput[]): Promise<{ created: number; tours: TourManageDto[] }> {
    await this.categories.assertActiveIds(inputs.flatMap((input) => input.categoryIds));
    const created = await this.tours.insertMany(
      inputs.map((input) => ({ ...input, agencyId: agencyId as never, categoryIds: input.categoryIds as never })),
    );
    return { created: created.length, tours: await this.views.manageMany(created) };
  }

  async listOwn(agencyId: string, query: { page: number; limit: number; status?: TourStatus }): Promise<Page<TourManageDto>> {
    const { items, total } = await this.tours.listByAgency(agencyId, query.status, query);
    return buildPage(await this.views.manageMany(items), total, query);
  }

  async getOwn(agencyId: string, id: string): Promise<TourManageDto> {
    return this.views.manage(await this.requireOwned(agencyId, id));
  }

  /**
   * Use case "Edit tour". Locked while PENDING_REVIEW. Editing an APPROVED tour sends it back to PENDING_REVIEW
   * (DECISIONS D-14) — existing bookings keep their price snapshot.
   */
  async updateTour(agencyId: string, id: string, input: UpdateTourInput): Promise<TourManageDto> {
    const tour = await this.requireOwned(agencyId, id);
    this.assertAgencyEditable(tour);
    if (input.categoryIds) await this.categories.assertActiveIds(input.categoryIds);
    if (input.durationDays !== undefined && tour.itinerary.some((day) => day.day > input.durationDays!)) {
      throw AppError.badRequest('durationDays is shorter than the configured itinerary', undefined, 'ITINERARY_EXCEEDS_DURATION');
    }
    return this.applyContentChange(tour, { $set: { ...input } });
  }

  /** Use case "Delete tour": archives it (soft delete). Refused while future departures have booked seats. */
  async deleteTour(agencyId: string, id: string): Promise<void> {
    const tour = await this.requireOwned(agencyId, id);
    assertTransition(TOUR_TRANSITIONS, tour.status as TourStatus, TOUR_STATUS.ARCHIVED, ENTITY);
    const hasUpcomingBookings = tour.departures.some((d) => d.date.getTime() > Date.now() && d.remaining < d.capacity);
    if (hasUpcomingBookings) {
      throw AppError.conflict('This tour has booked upcoming departures; close them instead of deleting', 'TOUR_HAS_BOOKINGS');
    }
    const updated = await this.tours.updateIfStatus(id, [tour.status as TourStatus], { $set: { status: TOUR_STATUS.ARCHIVED } });
    if (!updated) throw AppError.conflict('The tour was modified, please retry', 'CONCURRENT_UPDATE');
  }

  /**
   * Use case "Set tour availability". Departures are matched by id. Rules: capacity can never drop below the seats
   * already sold; a departure with sold seats cannot be removed or moved (close it instead); new/moved dates must be future.
   */
  async setAvailability(agencyId: string, id: string, inputs: DepartureInput[]): Promise<TourManageDto> {
    const tour = await this.requireOwned(agencyId, id);
    if (tour.status === TOUR_STATUS.ARCHIVED) throw AppError.notFound('Tour not found');

    const existing = new Map(tour.departures.map((d) => [String(d._id), d]));
    const keptIds = new Set(inputs.map((d) => d.id).filter(Boolean));
    for (const [departureId, departure] of existing) {
      if (!keptIds.has(departureId) && departure.remaining < departure.capacity) {
        throw AppError.conflict('A departure with booked seats cannot be removed; close it instead', 'DEPARTURE_HAS_BOOKINGS');
      }
    }

    const now = Date.now();
    const next = inputs.map((input) => {
      if (!input.id) {
        if (input.date.getTime() <= now) throw AppError.badRequest('New departures must be in the future');
        return { date: input.date, capacity: input.capacity, remaining: input.capacity, priceOverride: input.priceOverride, isOpen: input.isOpen };
      }
      const current = existing.get(input.id);
      if (!current) throw AppError.badRequest(`Unknown departure id ${input.id}`);
      const booked = current.capacity - current.remaining;
      if (input.capacity < booked) {
        throw AppError.conflict(`Capacity cannot be below the ${booked} seats already booked`, 'CAPACITY_BELOW_BOOKED');
      }
      if (booked > 0 && input.date.getTime() !== current.date.getTime()) {
        throw AppError.conflict('The date of a departure with booked seats cannot change', 'DEPARTURE_HAS_BOOKINGS');
      }
      if (booked === 0 && input.date.getTime() !== current.date.getTime() && input.date.getTime() <= now) {
        throw AppError.badRequest('Departures must be in the future');
      }
      return {
        _id: current._id,
        date: input.date,
        capacity: input.capacity,
        remaining: input.capacity - booked,
        priceOverride: input.priceOverride,
        isOpen: input.isOpen,
      };
    });

    const updated = await this.tours.replaceDeparturesIfVersion(id, tour.__v ?? 0, next);
    if (!updated) throw AppError.conflict('Seats changed while saving, please retry', 'CONCURRENT_UPDATE');
    return this.views.manage(updated);
  }

  /** Use case "Config itinerary". Content change: an APPROVED tour goes back to review. */
  async setItinerary(agencyId: string, id: string, days: ItineraryDayInput[]): Promise<TourManageDto> {
    const tour = await this.requireOwned(agencyId, id);
    this.assertAgencyEditable(tour);
    if (days.some((day) => day.day > tour.durationDays)) {
      throw AppError.badRequest(`Itinerary days cannot exceed durationDays (${tour.durationDays})`, undefined, 'ITINERARY_EXCEEDS_DURATION');
    }
    const itinerary = [...days]
      .sort((a, b) => a.day - b.day)
      .map((day) => ({ day: day.day, title: day.title, description: day.description, activities: day.activities ?? [] }));
    return this.applyContentChange(tour, { $set: { itinerary } });
  }

  /** Use case "Assign guide to tour". `guideId: null` removes the assignment. A new assignment starts PENDING. */
  async assignGuide(agencyId: string, id: string, input: { guideId: string | null; feePerBooking?: number }): Promise<TourManageDto> {
    const tour = await this.requireOwned(agencyId, id);
    if (tour.status === TOUR_STATUS.ARCHIVED) throw AppError.notFound('Tour not found');

    let update;
    if (input.guideId === null) {
      update = { $unset: { guide: 1 } };
    } else {
      await this.users.assertActiveWithRole(input.guideId, ROLES.TOUR_GUIDE);
      update = { $set: { guide: { guideId: input.guideId, feePerBooking: input.feePerBooking ?? 0, status: GUIDE_ASSIGNMENT_STATUS.PENDING } } };
    }
    const updated = await this.tours.updateIfStatus(id, [tour.status as TourStatus], update as never);
    if (!updated) throw AppError.conflict('The tour was modified, please retry', 'CONCURRENT_UPDATE');
    if (input.guideId !== null) {
      await this.notifications.notify(input.guideId, {
        type: NOTIFICATION_TYPE.GUIDE_ASSIGNED,
        title: 'You were assigned to a tour',
        body: `An agency assigned you to "${tour.title}". Please accept or decline the assignment.`,
        data: { tourId: tour.id },
      });
    }
    return this.views.manage(updated);
  }

  /** Submits for moderator review. Needs a VERIFIED agency, a category and at least one bookable future departure (D-27, D-28). */
  async submitForReview(agencyId: string, id: string): Promise<TourManageDto> {
    const tour = await this.requireOwned(agencyId, id);
    assertTransition(TOUR_TRANSITIONS, tour.status as TourStatus, TOUR_STATUS.PENDING_REVIEW, ENTITY);
    await this.users.assertAgencyVerified(agencyId);

    if (tour.categoryIds.length === 0) throw AppError.badRequest('Add at least one category before submitting');
    if (!tour.departures.some((d) => d.isOpen && d.date.getTime() > Date.now())) {
      throw AppError.badRequest('Add at least one open future departure before submitting', undefined, 'NO_OPEN_DEPARTURE');
    }
    const updated = await this.tours.updateIfStatus(id, [tour.status as TourStatus], {
      $set: { status: TOUR_STATUS.PENDING_REVIEW, submittedAt: new Date() },
      $unset: { statusReason: 1 },
    });
    if (!updated) throw AppError.conflict('The tour was modified, please retry', 'CONCURRENT_UPDATE');
    return this.views.manage(updated);
  }

  // ============================================================ Tour guide

  /** Use case "View assigned tours". */
  async listAssigned(guideId: string, page: { page: number; limit: number }): Promise<Page<GuideTourDto>> {
    const { items, total } = await this.tours.listByGuide(guideId, page);
    return buildPage(await this.views.guideItems(items), total, page);
  }

  /** Use case "Verify assigned tours": the guide accepts or declines their own PENDING assignment. */
  async answerAssignment(guideId: string, tourId: string, answer: { accept: boolean; note?: string }): Promise<GuideTourDto> {
    const tour = await this.tours.findById(tourId);
    if (!tour || tour.guide?.guideId?.toString() !== guideId || tour.status === TOUR_STATUS.ARCHIVED) {
      throw AppError.notFound('Assigned tour not found');
    }
    const next = answer.accept ? GUIDE_ASSIGNMENT_STATUS.ACCEPTED : GUIDE_ASSIGNMENT_STATUS.DECLINED;
    assertTransition(GUIDE_ASSIGNMENT_TRANSITIONS, tour.guide.status as 'PENDING', next, 'Guide assignment');

    const updated = await this.tours.answerGuideAssignment(tourId, guideId, {
      $set: { 'guide.status': next, 'guide.respondedAt': new Date(), ...(answer.note ? { 'guide.note': answer.note } : {}) },
    });
    if (!updated) throw AppError.conflict('The assignment changed, please retry', 'CONCURRENT_UPDATE');
    await this.notifications.notify(String(tour.agencyId), {
      type: NOTIFICATION_TYPE.GUIDE_ASSIGNMENT_ANSWERED,
      title: answer.accept ? 'Guide accepted the assignment' : 'Guide declined the assignment',
      body: `The guide ${answer.accept ? 'accepted' : 'declined'} "${tour.title}".${answer.note ? ` Note: ${answer.note}` : ''}`,
      data: { tourId: tour.id },
    });
    return (await this.views.guideItems([updated]))[0]!;
  }

  // ========================================================== Moderation

  /** Called by `moderation`: every-status tour list for "View tour lists". */
  async listForModeration(filter: ListTourFilter, page: { page: number; limit: number }): Promise<Page<TourManageDto>> {
    const { items, total } = await this.tours.listForModeration(filter, page);
    return buildPage(await this.views.manageMany(items), total, page);
  }

  async getForModeration(id: string): Promise<TourManageDto> {
    const tour = await this.tours.findById(id);
    if (!tour) throw AppError.notFound('Tour not found');
    return this.views.manage(tour);
  }

  /** Use case "Validate tour": PENDING_REVIEW -> APPROVED | REJECTED (a reason is mandatory to reject). */
  async decideReview(actor: Actor, id: string, decision: { approve: boolean; reason?: string }): Promise<TourManageDto> {
    if (!decision.approve && !decision.reason) throw AppError.badRequest('A reason is required to reject a tour');
    const tour = await this.tours.findById(id);
    if (!tour) throw AppError.notFound('Tour not found');

    const next = decision.approve ? TOUR_STATUS.APPROVED : TOUR_STATUS.REJECTED;
    assertTransition(TOUR_TRANSITIONS, tour.status as TourStatus, next, ENTITY);
    const updated = await this.tours.updateIfStatus(id, [TOUR_STATUS.PENDING_REVIEW], {
      $set: { status: next, reviewedAt: new Date(), reviewedBy: actor.userId, ...(decision.approve ? {} : { statusReason: decision.reason }) },
      ...(decision.approve ? { $unset: { statusReason: 1 } } : {}),
    } as never);
    if (!updated) throw AppError.conflict('The tour was modified, please retry', 'CONCURRENT_UPDATE');

    await this.audit.record({
      actorId: actor.userId,
      actorRole: actor.role,
      action: AUDIT_ACTIONS.TOUR_VALIDATED,
      targetType: 'tour',
      targetId: id,
      metadata: { approved: decision.approve, reason: decision.reason },
    });
    await this.notifications.notify(
      String(tour.agencyId),
      {
        type: decision.approve ? NOTIFICATION_TYPE.TOUR_APPROVED : NOTIFICATION_TYPE.TOUR_REJECTED,
        title: decision.approve ? 'Your tour was approved' : 'Your tour was rejected',
        body: decision.approve ? `"${tour.title}" is now public.` : `"${tour.title}" was rejected: ${decision.reason}`,
        data: { tourId: tour.id },
      },
      { email: true },
    );
    return this.views.manage(updated);
  }

  /** Use case "Suspend tours": APPROVED -> SUSPENDED (hidden from the public, existing bookings untouched). */
  async suspendTour(actor: Actor, id: string, reason: string): Promise<TourManageDto> {
    const tour = await this.tours.findById(id);
    if (!tour) throw AppError.notFound('Tour not found');
    assertTransition(TOUR_TRANSITIONS, tour.status as TourStatus, TOUR_STATUS.SUSPENDED, ENTITY);

    const updated = await this.tours.updateIfStatus(id, [TOUR_STATUS.APPROVED], {
      $set: { status: TOUR_STATUS.SUSPENDED, reviewedAt: new Date(), reviewedBy: actor.userId, statusReason: reason },
    });
    if (!updated) throw AppError.conflict('The tour was modified, please retry', 'CONCURRENT_UPDATE');

    await this.audit.record({
      actorId: actor.userId,
      actorRole: actor.role,
      action: AUDIT_ACTIONS.TOUR_SUSPENDED,
      targetType: 'tour',
      targetId: id,
      metadata: { reason },
    });
    await this.notifications.notify(
      String(tour.agencyId),
      {
        type: NOTIFICATION_TYPE.TOUR_SUSPENDED,
        title: 'Your tour was suspended',
        body: `"${tour.title}" was suspended: ${reason}`,
        data: { tourId: tour.id },
      },
      { email: true },
    );
    return this.views.manage(updated);
  }

  // ================================================ Inventory (bookings)

  /** Everything a booking needs to price and reserve a departure. Throws 404/409 unless it can be booked now. */
  async getBookableDeparture(tourId: string, departureId: string): Promise<BookableDeparture> {
    const tour = await this.tours.findById(tourId);
    if (!tour || tour.status !== TOUR_STATUS.APPROVED) throw AppError.notFound('Tour not found');
    const departure = tour.departures.find((d) => String(d._id) === departureId);
    if (!departure) throw AppError.notFound('Departure not found');
    if (!isBookable(departure)) throw AppError.conflict('This departure is closed or sold out', 'DEPARTURE_UNAVAILABLE');
    return {
      tourId: tour.id,
      agencyId: String(tour.agencyId),
      title: tour.title,
      durationDays: tour.durationDays,
      departureId,
      departureDate: departure.date,
      unitPrice: departurePrice(tour, departure),
      remaining: departure.remaining,
      guide: tour.guide
        ? { guideId: String(tour.guide.guideId), feePerBooking: tour.guide.feePerBooking, status: tour.guide.status as never }
        : undefined,
    };
  }

  /** Atomic; throws 409 `NOT_ENOUGH_SEATS` instead of overselling. */
  async reserveSeats(tourId: string, departureId: string, seats: number): Promise<void> {
    if (!(await this.tours.reserveSeats(tourId, departureId, seats))) {
      throw AppError.conflict('Not enough seats left on this departure', 'NOT_ENOUGH_SEATS');
    }
  }

  releaseSeats(tourId: string, departureId: string, seats: number): Promise<void> {
    return this.tours.releaseSeats(tourId, departureId, seats);
  }

  /** Tours per status (one agency, or the whole platform) for dashboards. */
  async countByStatus(agencyId?: string): Promise<Record<string, number>> {
    const rows = await this.tours.countByStatus(agencyId);
    return Object.fromEntries(rows.map((row) => [row._id, row.count]));
  }

  /** Called by `reviews` after the visible reviews of a tour changed. */
  async updateRatingStats(tourId: string, ratingAvg: number, ratingCount: number): Promise<void> {
    await this.tours.setRatingStats(tourId, ratingAvg, ratingCount);
  }

  /** Minimal facts about a tour of ANY status (bookings/reviews/earnings need them after the tour changed). */
  async getTourFacts(
    tourId: string,
  ): Promise<{ id: string; agencyId: string; title: string; status: TourStatus; guideId?: string; guideFee?: number } | null> {
    const tour = await this.tours.findById(tourId);
    if (!tour) return null;
    return {
      id: tour.id,
      agencyId: String(tour.agencyId),
      title: tour.title,
      status: tour.status as TourStatus,
      guideId: tour.guide?.status === GUIDE_ASSIGNMENT_STATUS.ACCEPTED ? String(tour.guide.guideId) : undefined,
      guideFee: tour.guide?.status === GUIDE_ASSIGNMENT_STATUS.ACCEPTED ? tour.guide.feePerBooking : undefined,
    };
  }

  // ================================================================ helpers

  /** 404 (never 403) when the tour is not the agency's own, so ids of other agencies are not revealed. */
  private async requireOwned(agencyId: string, id: string): Promise<TourDocument> {
    const tour = await this.tours.findById(id);
    if (!tour || String(tour.agencyId) !== agencyId || tour.status === TOUR_STATUS.ARCHIVED) {
      throw AppError.notFound('Tour not found');
    }
    return tour;
  }

  private assertAgencyEditable(tour: TourDocument): void {
    if (!AGENCY_EDITABLE_STATUSES.includes(tour.status as TourStatus)) {
      throw AppError.conflict(`A tour in status ${tour.status} cannot be edited`, 'TOUR_LOCKED');
    }
  }

  /** Applies a content update; an APPROVED tour re-enters review (compare-and-set on the status we read). */
  private async applyContentChange(tour: TourDocument, update: { $set: Record<string, unknown> }): Promise<TourManageDto> {
    const current = tour.status as TourStatus;
    let $set = update.$set;
    if (current === TOUR_STATUS.APPROVED) {
      assertTransition(TOUR_TRANSITIONS, current, TOUR_STATUS.PENDING_REVIEW, ENTITY);
      $set = { ...$set, status: TOUR_STATUS.PENDING_REVIEW, submittedAt: new Date() };
    }
    const updated = await this.tours.updateIfStatus(tour.id, [current], { $set } as never);
    if (!updated) throw AppError.conflict('The tour was modified, please retry', 'CONCURRENT_UPDATE');
    return this.views.manage(updated);
  }
}

export const toursService = new ToursService();
