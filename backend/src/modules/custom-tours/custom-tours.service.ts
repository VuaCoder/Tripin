import { CUSTOM_TOUR_STATUS, PASSENGER_TYPE, ROLES, TOUR_STATUS, TOUR_VISIBILITY, guestTotal, type AgePricing, type CustomTourStatus, type GuestCounts, type PersistedRole } from '@travel-platform/constants';
import { isUniqueViolation } from '../../config/database';
import { AppError } from '../../utils/app-error';
import { priceGuests } from '../../utils/age-pricing';
import { logger } from '../../utils/logger';
import { buildPage, type Page } from '../../utils/pagination';
import { assertTransition } from '../../utils/state-machine';
import { bookingsService, type BookingsService } from '../bookings';
import { categoriesService, type CategoriesService } from '../categories';
import { chatService, emitChatUpdated, type ChatService } from '../chat';
import { NOTIFICATION_TYPE, notificationsService, type NotificationsService } from '../notifications';
import { toursDiscoveryService, toursService, type ToursDiscoveryService, type ToursService } from '../tours';
import { usersService, type UsersService } from '../users';
import { toCustomTourRequestDto } from './custom-tours.mapper';
import { customTourCheckoutDraft } from './custom-tours.validation';
import {
  customToursRepository,
  type CustomTourRecord,
  type CustomTourScope,
  type CustomToursRepository,
  type PrivateTourFacts,
} from './custom-tours.repository';
import {
  CUSTOM_TOUR_TRANSITIONS,
  type CreateCustomTourInput,
  type CustomTourDecision,
  type CustomTourOffer,
  type CustomTourPassengerDraft,
  type CustomTourBookingResult,
  type CustomTourRequestDto,
  type ListCustomToursQuery,
  type SaveCustomTourCheckoutInput,
  type SaveCustomTourDraftInput,
} from './custom-tours.types';

type Actor = { userId: string; role: PersistedRole };
type Repo = Pick<
  CustomToursRepository,
  'create' | 'findById' | 'findByClientRequestId' | 'setConversationId' | 'list' | 'decide' | 'accept'
  | 'saveDraft' | 'offer' | 'acceptOffer' | 'findPrivateTourFacts' | 'saveCheckoutDraft'
>;

const ENTITY = 'Custom tour request';
const S = CUSTOM_TOUR_STATUS;

/**
 * Group-booking requests: a traveler asks for a private departure of a public tour, the agency answers in chat.
 * This module never prices or holds seats — the offer is a snapshot and the booking (S10) reuses `bookings`.
 */
export class CustomToursService {
  constructor(
    private readonly requests: Repo = customToursRepository,
    private readonly tours: Pick<ToursService, 'getBriefs'> = toursService,
    private readonly users: Pick<UsersService, 'assertAgencyVerified'> = usersService,
    private readonly chat: Pick<ChatService, 'startConversation'> = chatService,
    private readonly notifications: Pick<NotificationsService, 'notify' | 'notifyAgency'> = notificationsService,
    private readonly discovery: Pick<ToursDiscoveryService, 'invalidateCache'> = toursDiscoveryService,
    private readonly categories: Pick<CategoriesService, 'assertActiveIds'> = categoriesService,
    private readonly bookings: Pick<BookingsService, 'createBooking' | 'activeForCustomTour' | 'activeForCustomTours'> = bookingsService,
  ) {}

  /** Use case "Request a group booking". The source tour must be an APPROVED, PUBLIC tour of a verified agency. */
  async create(travelerId: string, input: CreateCustomTourInput): Promise<CustomTourRequestDto> {
    const source = (await this.tours.getBriefs([input.sourceTourId])).get(input.sourceTourId);
    if (!source || source.status !== TOUR_STATUS.APPROVED || source.visibility !== TOUR_VISIBILITY.PUBLIC) {
      throw AppError.notFound('Tour not found');
    }
    // A traveler must not learn why an agency cannot take requests; the tour simply is not offered.
    try {
      await this.users.assertAgencyVerified(source.agencyId);
    } catch {
      throw AppError.notFound('Tour not found');
    }

    if (input.clientRequestId) {
      const existing = await this.requests.findByClientRequestId(travelerId, input.clientRequestId);
      if (existing) return this.replay(existing, input);
    }

    let record: CustomTourRecord;
    try {
      record = await this.requests.create({
        travelerId,
        agencyId: source.agencyId,
        sourceTourId: source.id,
        participants: input.participants,
        ...(input.guestCounts ? { guestCounts: input.guestCounts } : {}),
        ...(input.startDate ? { startDate: input.startDate } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
        ...(input.clientRequestId ? { clientRequestId: input.clientRequestId } : {}),
      });
    } catch (error) {
      if (!input.clientRequestId || !isUniqueViolation(error)) throw error;
      const winner = await this.requests.findByClientRequestId(travelerId, input.clientRequestId);
      if (!winner) throw error;
      return this.replay(winner, input);
    }

    // Chat is best-effort: a failure here must not lose the request.
    const conversationId = await this.ensureConversation(record);

    await this.notifications.notifyAgency(source.agencyId, {
      type: NOTIFICATION_TYPE.CUSTOM_TOUR_REQUESTED,
      title: 'Yêu cầu booking đoàn mới',
      body: `Có yêu cầu cho ${input.participants} khách từ tour "${source.title}".`,
      data: { requestId: record.id, ...(conversationId ? { conversationId } : {}) },
    });

    return toCustomTourRequestDto({ ...record, conversationId: conversationId ?? record.conversationId }, new Map([[source.id, source]]));
  }

  /** Traveler: their own requests. Agency: the ones addressed to it. */
  async list(actor: Actor, query: ListCustomToursQuery): Promise<Page<CustomTourRequestDto>> {
    const scope: CustomTourScope = actor.role === ROLES.TRAVELER ? { travelerId: actor.userId } : { agencyId: actor.userId };
    const { items, total } = await this.requests.list(scope, query);
    const [briefs, bookings] = await Promise.all([
      this.tours.getBriefs(items.flatMap((item) => [item.sourceTourId, ...(item.privateTourId ? [item.privateTourId] : [])])),
      this.bookings.activeForCustomTours(items.map((item) => item.id)),
    ]);
    return buildPage(items.map((item) => toCustomTourRequestDto(item, briefs, bookings.get(item.id))), total, query);
  }

  /** 404 (never 403) for anyone else's request, so ids are not revealed. */
  async get(actor: Actor, id: string): Promise<CustomTourRequestDto> {
    const record = await this.requests.findById(id);
    const mine = record && (actor.role === ROLES.TRAVELER ? record.travelerId === actor.userId : record.agencyId === actor.userId);
    if (!record || !mine) throw AppError.notFound('Custom tour request not found');
    return this.describe(record);
  }

  /**
   * The agency answers a fresh request (accept/decline) or the traveler withdraws it. Both roles hold
   * `custom-tour:respond`, so the role check lives here: only the receiving agency answers, only its owner withdraws.
   * Accepting clones the source into the one private tour (D-85); declining never does.
   */
  async decide(actor: Actor, id: string, decision: CustomTourDecision): Promise<CustomTourRequestDto> {
    const record = await this.requests.findById(id);
    const mine = record && (record.travelerId === actor.userId || record.agencyId === actor.userId);
    if (!record || !mine) throw AppError.notFound('Custom tour request not found');
    const travelerActs = actor.role === ROLES.TRAVELER;
    if (travelerActs !== (decision === 'CANCEL')) throw AppError.notFound('Custom tour request not found');

    const from = record.status as CustomTourStatus;
    const to = decision === 'ACCEPT' ? S.NEGOTIATING : decision === 'DECLINE' ? S.DECLINED : S.CANCELLED;
    assertTransition(CUSTOM_TOUR_TRANSITIONS, from, to, ENTITY);

    const updated = decision === 'ACCEPT' ? await this.requests.accept(id) : await this.requests.decide(id, from, to);
    if (!updated) throw AppError.invalidTransition(from, to, ENTITY);
    // The clone is new/private today, but S5 flips it APPROVED; clearing now keeps every public read model honest.
    if (decision === 'ACCEPT') this.discovery.invalidateCache(updated.privateTourId ?? undefined);

    const conversationId = await this.ensureConversation(updated);
    await this.notifyDecision(updated, decision, conversationId);
    this.nudge(updated, conversationId);
    return this.describe(updated);
  }

  /**
   * Use case "Save a draft". The agency edits the private tour and the terms in one transaction guarded by the
   * revision it saw. Saving from OFFERED voids the old snapshot and returns the request to NEGOTIATING.
   */
  async saveDraft(actor: Actor, id: string, input: SaveCustomTourDraftInput): Promise<CustomTourRequestDto> {
    const record = await this.requireAgencyRequest(actor, id);
    const from = record.status as CustomTourStatus;
    if (from !== S.NEGOTIATING && from !== S.OFFERED) throw AppError.invalidTransition(from, S.NEGOTIATING, ENTITY);
    if (input.guestCounts) this.assertGuestCounts(record, input.guestCounts);
    if (input.departure?.capacity !== undefined && input.departure.capacity !== record.participants) {
      throw AppError.badRequest(`Departure capacity must equal participants (${record.participants})`);
    }
    if (input.content?.categoryIds) await this.categories.assertActiveIds(input.content.categoryIds);

    const updated = await this.requests.saveDraft(id, input.revision, {
      ...(input.content ? { content: input.content } : {}),
      ...(input.guestCounts ? { guestCounts: input.guestCounts } : {}),
      ...(input.departure ? { departure: { date: input.departure.date } } : {}),
    });
    if (!updated) throw AppError.conflict('The request was changed; reload and retry', 'CONCURRENT_UPDATE');

    this.nudge(updated);
    return this.describe(updated);
  }

  /** Use case "Send the offer". The server computes the money: the body never carries a price. */
  async sendOffer(actor: Actor, id: string, revision: number): Promise<CustomTourRequestDto> {
    const record = await this.requireAgencyRequest(actor, id);
    const from = record.status as CustomTourStatus;
    assertTransition(CUSTOM_TOUR_TRANSITIONS, from, S.OFFERED, ENTITY);
    if (!record.privateTourId) throw AppError.conflict('This request has no private tour', 'INVALID_STATE_TRANSITION');

    const tour = await this.requests.findPrivateTourFacts(record.privateTourId);
    if (!tour) throw AppError.conflict('This request has no private tour', 'INVALID_STATE_TRANSITION');
    const { departureDate, guests } = this.assertOfferable(record, tour);
    // Throws 400 VALIDATION_ERROR when the saved counts cannot be priced (e.g. children without age pricing).
    const { subtotal } = priceGuests(tour.basePrice, record.participants, guests, tour.agePricing);

    const snapshot: CustomTourOffer = {
      revision: record.revision,
      unitPrice: tour.basePrice,
      agePricing: tour.agePricing,
      guestCounts: guests,
      subtotal,
      departureDate: departureDate.toISOString(),
      sentAt: new Date().toISOString(),
      // The traveler sees exactly these terms; a later edit voids this snapshot and returns the request to NEGOTIATING.
      content: {
        title: tour.title,
        destination: tour.destination,
        durationDays: tour.durationDays,
        summary: tour.summary ?? undefined,
        description: tour.description ?? undefined,
        inclusions: tour.inclusions,
        exclusions: tour.exclusions,
        childPricingPolicy: tour.childPricingPolicy ?? undefined,
        cancellationPolicy: tour.cancellationPolicy ?? undefined,
        travelNotes: tour.travelNotes ?? undefined,
        requiredDocuments: tour.requiredDocuments ?? undefined,
      },
    };
    // A draft that bumped the revision meanwhile wins; this tab gets 409 and must reload.
    const updated = await this.requests.offer(id, revision, snapshot);
    if (!updated) throw AppError.conflict('The request was changed; reload and retry', 'CONCURRENT_UPDATE');

    await this.notifications.notify(updated.travelerId, {
      type: NOTIFICATION_TYPE.CUSTOM_TOUR_OFFERED,
      title: 'Agency đã gửi báo giá booking đoàn',
      body: `Agency đã gửi báo giá cho ${updated.participants} khách. Hãy xem và chấp nhận trong chat.`,
      data: { requestId: updated.id, ...(updated.conversationId ? { conversationId: updated.conversationId } : {}) },
    });
    this.nudge(updated);
    return this.describe(updated);
  }

  /** Use case "Accept the offer". Only the traveler, only the exact revision they reviewed. */
  async acceptOffer(actor: Actor, id: string, revision: number): Promise<CustomTourRequestDto> {
    const record = await this.requests.findById(id);
    if (!record || actor.role !== ROLES.TRAVELER || record.travelerId !== actor.userId) {
      throw AppError.notFound('Custom tour request not found');
    }
    const from = record.status as CustomTourStatus;
    assertTransition(CUSTOM_TOUR_TRANSITIONS, from, S.ACCEPTED, ENTITY);
    const snapshot = record.offerSnapshot as unknown as CustomTourOffer | null;
    if (!snapshot || snapshot.revision !== record.revision || revision !== record.revision) {
      throw AppError.conflict('The offer was changed; reload and review the latest version', 'CONCURRENT_UPDATE');
    }

    const updated = await this.requests.acceptOffer(id, record.revision, new Date());
    if (!updated) throw AppError.conflict('The offer was changed; reload and review the latest version', 'CONCURRENT_UPDATE');
    // The private tour just became APPROVED; the cache is cleared although it stays invisible (PRIVATE).
    this.discovery.invalidateCache(updated.privateTourId ?? undefined);

    await this.notifications.notifyAgency(updated.agencyId, {
      type: NOTIFICATION_TYPE.CUSTOM_TOUR_ACCEPTED,
      title: 'Khách đã chấp nhận báo giá booking đoàn',
      body: `Khách đã chấp nhận báo giá cho ${updated.participants} khách.`,
      data: { requestId: updated.id, ...(updated.conversationId ? { conversationId: updated.conversationId } : {}) },
    });
    this.nudge(updated);
    return this.describe(updated);
  }

  /**
   * Use case "Enter the members". Only the traveler's own ACCEPTED request: the head count and the age mix were frozen
   * with the offer, so the form fills in people, never who pays for what. The form has its own revision, so two devices
   * saving at once cannot silently overwrite each other's identity papers.
   */
  async saveCheckoutDraft(actor: Actor, id: string, input: SaveCustomTourCheckoutInput): Promise<CustomTourRequestDto> {
    const record = await this.requests.findById(id);
    if (!record || actor.role !== ROLES.TRAVELER || record.travelerId !== actor.userId) {
      throw AppError.notFound('Custom tour request not found');
    }
    const from = record.status as CustomTourStatus;
    if (from !== S.ACCEPTED) throw AppError.invalidTransition(from, S.ACCEPTED, ENTITY);
    this.assertCheckoutCounts(record, input.passengers);

    const updated = await this.requests.saveCheckoutDraft(id, input.checkoutRevision, {
      contact: input.contact,
      passengers: input.passengers,
      ...(input.notes ? { notes: input.notes } : {}),
    });
    if (!updated) throw AppError.conflict('The passenger form was saved on another device; reload and retry', 'CONCURRENT_UPDATE');
    return this.describe(updated);
  }

  /**
   * Use case "Book the group". The accepted offer is the price, the saved form is the passenger list, and the private
   * tour's own departure is the date. One request never yields two live bookings: an existing one is returned as is,
   * and a second tab that races the insert gets the winner's booking back.
   */
  async createBooking(actor: Actor, id: string, clientRequestId?: string): Promise<CustomTourBookingResult> {
    const record = await this.requests.findById(id);
    if (!record || actor.role !== ROLES.TRAVELER || record.travelerId !== actor.userId) {
      throw AppError.notFound('Custom tour request not found');
    }
    const from = record.status as CustomTourStatus;
    if (from !== S.ACCEPTED) throw AppError.invalidTransition(from, S.ACCEPTED, ENTITY);

    const existing = await this.bookings.activeForCustomTour(id);
    if (existing) return { booking: existing, created: false };

    const offer = record.offerSnapshot as unknown as CustomTourOffer | null;
    if (!offer || !record.privateTourId) throw AppError.conflict('This request has no accepted offer', 'INVALID_STATE_TRANSITION');
    const draft = customTourCheckoutDraft.safeParse(record.checkoutDraft);
    if (!draft.success) throw AppError.badRequest('The passenger form is not complete');
    this.assertCheckoutCounts(record, draft.data.passengers);

    // The frozen date must still be the departure that exists; a moved clone cannot silently book another day.
    const facts = await this.requests.findPrivateTourFacts(record.privateTourId);
    if (!facts || facts.status !== TOUR_STATUS.APPROVED) {
      throw AppError.conflict('The private tour of this offer is no longer bookable', 'TOUR_UNAVAILABLE');
    }
    const departureDate = new Date(offer.departureDate).getTime();
    if (departureDate <= Date.now()) {
      throw AppError.conflict('The departure of this offer has already passed', 'DEPARTURE_PASSED');
    }
    const departure = facts.departures.find(({ date }) => date.getTime() === departureDate);
    if (!departure) throw AppError.conflict('The departure of this offer is no longer available', 'DEPARTURE_UNAVAILABLE');

    const booking = await this.bookings.createBooking(record.travelerId, {
      tourId: record.privateTourId,
      departureId: departure.id,
      participants: record.participants,
      contact: draft.data.contact,
      ...(draft.data.notes ? { notes: draft.data.notes } : {}),
      ...(clientRequestId ? { clientRequestId } : {}),
      customTour: {
        requestId: record.id,
        unitPrice: offer.unitPrice,
        agePricing: (offer.agePricing ?? null) as AgePricing | null,
        guestCounts: offer.guestCounts,
        passengers: draft.data.passengers,
      },
    });
    this.nudge(record);
    return { booking, created: true };
  }

  // ============================================================== helpers

  /** The form must describe exactly the accepted group: same head count, same age groups, at least one adult. */
  private assertCheckoutCounts(record: CustomTourRecord, passengers: CustomTourPassengerDraft[]): void {
    if (passengers.length !== record.participants) {
      throw AppError.badRequest(`Exactly ${record.participants} passengers are required`);
    }
    const accepted = record.offerSnapshot as unknown as CustomTourOffer | null;
    const guests = accepted?.guestCounts
      ?? (record.guestCounts as unknown as GuestCounts | null)
      ?? { adults: record.participants, children: 0, infants: 0 };
    const counts: GuestCounts = { adults: 0, children: 0, infants: 0 };
    for (const passenger of passengers) {
      if (passenger.guestType === PASSENGER_TYPE.ADULT) counts.adults += 1;
      else if (passenger.guestType === PASSENGER_TYPE.CHILD) counts.children += 1;
      else counts.infants += 1;
    }
    if (counts.adults < 1) throw AppError.badRequest('At least one passenger must be an adult');
    if (counts.adults !== guests.adults || counts.children !== guests.children || counts.infants !== guests.infants) {
      throw AppError.badRequest('Passenger age groups must match the accepted guest counts');
    }
  }

  /** Agency only, owner only; 404 for everyone else so request ids are not revealed. */
  private async requireAgencyRequest(actor: Actor, id: string): Promise<CustomTourRecord> {
    const record = await this.requests.findById(id);
    if (!record || actor.role !== ROLES.AGENCY || record.agencyId !== actor.userId) {
      throw AppError.notFound('Custom tour request not found');
    }
    return record;
  }

  /** Guest counts always describe the requested head count, with at least one adult. */
  private assertGuestCounts(record: CustomTourRecord, guests: GuestCounts): void {
    if (guests.adults < 1) throw AppError.badRequest('Guest counts must include at least one adult');
    if (guestTotal(guests) !== record.participants) throw AppError.badRequest('Guest counts must sum to participants');
  }

  /** Everything an offer needs that can still be missing after a draft; returns the one departure and the counts. */
  private assertOfferable(record: CustomTourRecord, tour: PrivateTourFacts): { departureDate: Date; guests: GuestCounts } {
    if (!tour.title.trim() || !tour.destination.trim() || tour.durationDays < 1) {
      throw AppError.badRequest('The private tour is missing title, destination or duration');
    }
    if (tour.basePrice <= 0) throw AppError.badRequest('The private tour price must be greater than 0');
    const future = tour.departures.filter((departure) => departure.date.getTime() > Date.now());
    if (future.length !== 1) throw AppError.badRequest('The private tour must have exactly one future departure');
    if (!record.guestCounts) throw AppError.badRequest('Guest counts are required before sending an offer');
    const guests = record.guestCounts as unknown as GuestCounts;
    this.assertGuestCounts(record, guests);
    return { departureDate: future[0]!.date, guests };
  }

  /**
   * Realtime nudge only: clients refetch over REST, which stays the source of truth (D-85).
   * shortcut: the agency counterpart is its owner's User.id (AgencyProfile.id == userId while onboarding links a user);
   * an independent agency with no linked user needs member routing, upgrade when that onboarding ships.
   */
  private nudge(record: CustomTourRecord, conversationId = record.conversationId): void {
    if (conversationId) emitChatUpdated([record.travelerId, record.agencyId], conversationId);
  }

  /** Starts the traveler↔agency conversation once; a chat failure must not lose the request. */
  private async ensureConversation(record: CustomTourRecord): Promise<string | undefined> {
    if (record.conversationId) return record.conversationId;
    try {
      const conversation = await this.chat.startConversation(
        { userId: record.travelerId, role: ROLES.TRAVELER },
        { participantId: record.agencyId, tourId: record.sourceTourId },
      );
      await this.requests.setConversationId(record.id, conversation.id);
      return conversation.id;
    } catch (error) {
      logger.warn('Custom tour request has no conversation', { requestId: record.id, message: (error as Error).message });
      return undefined;
    }
  }

  private async notifyDecision(record: CustomTourRecord, decision: CustomTourDecision, conversationId?: string): Promise<void> {
    const data = { requestId: record.id, ...(conversationId ? { conversationId } : {}) };
    const copy = {
      ACCEPT: { title: 'Agency đã nhận yêu cầu booking đoàn', body: `Hãy trao đổi trong chat để chốt lịch trình và giá cho ${record.participants} khách.` },
      DECLINE: { title: 'Yêu cầu booking đoàn bị từ chối', body: `Agency không nhận được yêu cầu cho ${record.participants} khách.` },
      CANCEL: { title: 'Khách đã rút yêu cầu booking đoàn', body: `Yêu cầu cho ${record.participants} khách đã được rút.` },
    }[decision];
    const input = { type: NOTIFICATION_TYPE.CUSTOM_TOUR_DECIDED, title: copy.title, body: copy.body, data } as const;
    // A withdrawal reaches the whole agency; accept/decline reach the traveler.
    if (decision === 'CANCEL') await this.notifications.notifyAgency(record.agencyId, input);
    else await this.notifications.notify(record.travelerId, input);
  }

  private async describe(record: CustomTourRecord): Promise<CustomTourRequestDto> {
    const [briefs, booking] = await Promise.all([
      this.tours.getBriefs([record.sourceTourId, ...(record.privateTourId ? [record.privateTourId] : [])]),
      this.bookings.activeForCustomTour(record.id),
    ]);
    return toCustomTourRequestDto(
      record,
      briefs,
      booking ? { id: booking.id, status: booking.status, bookingCode: booking.bookingCode, isPaid: booking.isPaid } : undefined,
    );
  }

  /** Same clientRequestId is a retry only when the payload matches; otherwise the key was reused by mistake. */
  private async replay(record: CustomTourRecord, input: CreateCustomTourInput): Promise<CustomTourRequestDto> {
    const same =
      record.sourceTourId === input.sourceTourId &&
      record.participants === input.participants &&
      (record.notes ?? null) === (input.notes ?? null) &&
      (record.startDate?.getTime() ?? null) === (input.startDate?.getTime() ?? null) &&
      // Guest counts key order is fixed by the schema, so the serialised forms are comparable.
      JSON.stringify(record.guestCounts ?? null) === JSON.stringify(input.guestCounts ?? null);
    if (!same) throw AppError.conflict('clientRequestId was already used for a different request', 'IDEMPOTENCY_KEY_REUSED');
    return this.describe(record);
  }
}

export const customToursService = new CustomToursService();
