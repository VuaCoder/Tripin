import { CUSTOM_TOUR_STATUS, TOUR_STATUS, TOUR_VISIBILITY, safeVndNumber, type AgePricing, type CustomTourStatus, type GuestCounts } from '@travel-platform/constants';
import { prisma, type Prisma } from '../../config/database';
import { Prisma as PrismaRuntime, type CustomTourRequest } from '../../generated/prisma/client';
import { toSkip, type PageRequest } from '../../utils/pagination';
import type { CustomTourCheckoutDraft, CustomTourDraftContent, CustomTourOffer } from './custom-tours.types';

export type CustomTourRecord = CustomTourRequest;

/** What an offer must validate and freeze: the private tour's facts and its departures, read in one query. */
export interface PrivateTourFacts {
  id: string;
  /** Tour workflow status; booking is refused once an admin suspends the private clone. */
  status: string;
  title: string;
  destination: string;
  durationDays: number;
  basePrice: number;
  agePricing: AgePricing | null;
  summary: string | null;
  description: string | null;
  inclusions: string[];
  exclusions: string[];
  childPricingPolicy: string | null;
  cancellationPolicy: string | null;
  travelNotes: string | null;
  requiredDocuments: string | null;
  departures: { id: string; date: Date }[];
}

/** Who is asking: a traveler sees their requests, an agency sees the ones addressed to it. */
export type CustomTourScope = { travelerId: string } | { agencyId: string };

export interface ListCustomToursFilter extends PageRequest {
  status?: CustomTourStatus;
  conversationId?: string;
}

function where(scope: CustomTourScope, filter: { status?: CustomTourStatus; conversationId?: string }) {
  return {
    ...scope,
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.conversationId ? { conversationId: filter.conversationId } : {}),
  };
}

export class CustomToursRepository {
  create(data: {
    travelerId: string;
    agencyId: string;
    sourceTourId: string;
    participants: number;
    guestCounts?: GuestCounts;
    startDate?: Date;
    notes?: string;
    clientRequestId?: string;
  }): Promise<CustomTourRecord> {
    const { guestCounts, ...rest } = data;
    // Spread keeps the counts a fresh object literal, which Prisma's JSON input type accepts.
    return prisma.customTourRequest.create({ data: { ...rest, ...(guestCounts ? { guestCounts: { ...guestCounts } } : {}) } });
  }

  findById(id: string): Promise<CustomTourRecord | null> {
    return prisma.customTourRequest.findUnique({ where: { id } });
  }

  findByClientRequestId(travelerId: string, clientRequestId: string): Promise<CustomTourRecord | null> {
    return prisma.customTourRequest.findUnique({ where: { travelerId_clientRequestId: { travelerId, clientRequestId } } });
  }

  /** Only fills the conversation once; a second call with the same id is a no-op. */
  async setConversationId(id: string, conversationId: string): Promise<void> {
    await prisma.customTourRequest.updateMany({ where: { id, conversationId: null }, data: { conversationId } });
  }

  /** Compare-and-set on status: the first decision wins, a later one reads `null`. */
  async decide(id: string, from: CustomTourStatus, to: CustomTourStatus): Promise<CustomTourRecord | null> {
    const { count } = await prisma.customTourRequest.updateMany({ where: { id, status: from }, data: { status: to } });
    return count ? prisma.customTourRequest.findUnique({ where: { id } }) : null;
  }

  /**
   * The agency accepted: one transaction moves SUBMITTED → NEGOTIATING and clones the source tour into a private
   * DRAFT, so no crash can leave the request pointing at no tour. Returns null when another decision got there first.
   */
  accept(id: string): Promise<CustomTourRecord | null> {
    return prisma.$transaction(async (tx) => {
      const cas = await tx.customTourRequest.updateMany({
        where: { id, status: CUSTOM_TOUR_STATUS.SUBMITTED },
        data: { status: CUSTOM_TOUR_STATUS.NEGOTIATING },
      });
      if (!cas.count) return null;

      const request = await tx.customTourRequest.findUniqueOrThrow({ where: { id } });
      const source = await tx.tour.findUniqueOrThrow({
        where: { id: request.sourceTourId },
        include: {
          categories: { select: { id: true } },
          departures: {
            where: { isOpen: true, date: { gt: new Date() } },
            orderBy: { date: 'asc' },
            take: 1,
            select: { date: true, priceOverride: true },
          },
        },
      });
      const next = source.departures[0];
      // The group's own start date wins while it is still ahead; otherwise keep the source's next departure.
      const startDate = request.startDate && request.startDate > new Date() ? request.startDate : next?.date;
      // Content is copied; workflow, rating and the guide assignment are not (D-85).
      const clone = await tx.tour.create({
        data: {
          agencyId: request.agencyId,
          title: source.title,
          summary: source.summary,
          description: source.description,
          childPricingPolicy: source.childPricingPolicy,
          cancellationPolicy: source.cancellationPolicy,
          travelNotes: source.travelNotes,
          meetingPoint: source.meetingPoint,
          requiredDocuments: source.requiredDocuments,
          destination: source.destination,
          durationDays: source.durationDays,
          basePrice: next?.priceOverride ?? source.basePrice,
          maxGroupSize: request.participants,
          images: source.images,
          inclusions: source.inclusions,
          exclusions: source.exclusions,
          itinerary: source.itinerary as Prisma.InputJsonValue,
          status: TOUR_STATUS.DRAFT,
          visibility: TOUR_VISIBILITY.PRIVATE,
          ...(source.agePricing === null ? {} : { agePricing: source.agePricing as Prisma.InputJsonValue }),
          ...(source.categories.length ? { categories: { connect: source.categories } } : {}),
          ...(startDate ? { departures: { create: [{ date: startDate, capacity: request.participants, remaining: request.participants }] } } : {}),
        },
      });
      return tx.customTourRequest.update({ where: { id }, data: { privateTourId: clone.id } });
    });
  }

  /**
   * Saves the agency draft in one transaction: the request revision (compare-and-set), the private tour content and
   * its single departure. Returning to NEGOTIATING clears the offer, so a snapshot from an older revision can never be
   * accepted. Returns null when the request moved meanwhile (another tab saved first).
   */
  async saveDraft(
    id: string,
    expectedRevision: number,
    input: { content?: CustomTourDraftContent; guestCounts?: GuestCounts; departure?: { date: Date } },
  ): Promise<CustomTourRecord | null> {
    return prisma.$transaction(async (tx) => {
      const current = await tx.customTourRequest.findUnique({ where: { id }, select: { privateTourId: true, participants: true } });
      if (!current?.privateTourId) return null;

      const cas = await tx.customTourRequest.updateMany({
        where: { id, revision: expectedRevision, status: { in: [CUSTOM_TOUR_STATUS.NEGOTIATING, CUSTOM_TOUR_STATUS.OFFERED] } },
        data: {
          revision: { increment: 1 },
          status: CUSTOM_TOUR_STATUS.NEGOTIATING,
          offerSnapshot: PrismaRuntime.DbNull,
          ...(input.guestCounts ? { guestCounts: { ...input.guestCounts } } : {}),
        },
      });
      if (!cas.count) return null;

      if (input.content) await tx.tour.update({ where: { id: current.privateTourId }, data: tourContentData(input.content) });
      if (input.departure) {
        // The clone is created with exactly one departure; its capacity stays `participants` (participants cannot change).
        const moved = await tx.tourDeparture.updateMany({ where: { tourId: current.privateTourId }, data: { date: input.departure.date } });
        if (!moved.count) {
          await tx.tourDeparture.create({
            data: { tourId: current.privateTourId, date: input.departure.date, capacity: current.participants, remaining: current.participants },
          });
        }
      }
      return tx.customTourRequest.findUniqueOrThrow({ where: { id } });
    });
  }

  /**
   * Compare-and-set on the checkout form only: the negotiation revision, the offer and the status stay untouched.
   * A second device saving the same revision reads `null` and must reload, so no member's papers are lost silently.
   */
  async saveCheckoutDraft(id: string, expectedRevision: number, draft: CustomTourCheckoutDraft): Promise<CustomTourRecord | null> {
    const { count } = await prisma.customTourRequest.updateMany({
      where: { id, checkoutRevision: expectedRevision },
      data: { checkoutDraft: draft as unknown as Prisma.InputJsonValue, checkoutRevision: { increment: 1 } },
    });
    return count ? prisma.customTourRequest.findUnique({ where: { id } }) : null;
  }

  /** Compare-and-set NEGOTIATING → OFFERED: a draft that bumped the revision meanwhile wins (caller gets null). */
  async offer(id: string, expectedRevision: number, snapshot: CustomTourOffer): Promise<CustomTourRecord | null> {
    const { count } = await prisma.customTourRequest.updateMany({
      where: { id, revision: expectedRevision, status: CUSTOM_TOUR_STATUS.NEGOTIATING },
      data: { status: CUSTOM_TOUR_STATUS.OFFERED, offerSnapshot: snapshot as unknown as Prisma.InputJsonValue },
    });
    return count ? prisma.customTourRequest.findUnique({ where: { id } }) : null;
  }

  /**
   * The traveler accepts exactly one offer: OFFERED → ACCEPTED plus the private tour DRAFT → APPROVED in one
   * transaction. Both updates are conditional; any mismatch rolls everything back and reads `null`.
   */
  async acceptOffer(id: string, expectedRevision: number, acceptedAt: Date): Promise<CustomTourRecord | null> {
    try {
      return await prisma.$transaction(async (tx) => {
        const cas = await tx.customTourRequest.updateMany({
          where: { id, revision: expectedRevision, status: CUSTOM_TOUR_STATUS.OFFERED },
          data: { status: CUSTOM_TOUR_STATUS.ACCEPTED, acceptedAt },
        });
        if (!cas.count) return null;

        const request = await tx.customTourRequest.findUniqueOrThrow({ where: { id } });
        if (!request.privateTourId) throw ACCEPT_CONFLICT;
        const approved = await tx.tour.updateMany({
          where: { id: request.privateTourId, status: TOUR_STATUS.DRAFT, visibility: TOUR_VISIBILITY.PRIVATE },
          data: { status: TOUR_STATUS.APPROVED },
        });
        if (approved.count !== 1) throw ACCEPT_CONFLICT;
        return request;
      });
    } catch (error) {
      if (error === ACCEPT_CONFLICT) return null;
      throw error;
    }
  }

  /** Sendable facts of the private tour (content, price and departures). */
  async findPrivateTourFacts(id: string): Promise<PrivateTourFacts | null> {
    const tour = await prisma.tour.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        destination: true,
        durationDays: true,
        basePrice: true,
        status: true,
        agePricing: true,
        summary: true,
        description: true,
        inclusions: true,
        exclusions: true,
        childPricingPolicy: true,
        cancellationPolicy: true,
        travelNotes: true,
        requiredDocuments: true,
        departures: { select: { id: true, date: true }, orderBy: { date: 'asc' } },
      },
    });
    return tour ? { ...tour, basePrice: safeVndNumber(tour.basePrice), agePricing: tour.agePricing as unknown as AgePricing | null } : null;
  }

  async list(scope: CustomTourScope, filter: ListCustomToursFilter): Promise<{ items: CustomTourRecord[]; total: number }> {
    const whereClause = where(scope, filter);
    const [items, total] = await Promise.all([
      prisma.customTourRequest.findMany({
        where: whereClause,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: toSkip(filter),
        take: filter.limit,
      }),
      prisma.customTourRequest.count({ where: whereClause }),
    ]);
    return { items, total };
  }
}

export const customToursRepository = new CustomToursRepository();

/** Thrown inside the acceptance transaction when the private tour is not the expected DRAFT, so it rolls back. */
const ACCEPT_CONFLICT = Symbol('custom-tour-accept-conflict');

/** Only the visible content fields; status, visibility and maxGroupSize are never written from a draft. */
function tourContentData(content: CustomTourDraftContent): Prisma.TourUncheckedUpdateInput {
  const { categoryIds, agePricing, ...scalars } = content;
  return {
    ...scalars,
    ...(agePricing !== undefined ? { agePricing: agePricing === null ? PrismaRuntime.DbNull : { ...agePricing } } : {}),
    ...(categoryIds ? { categories: { set: categoryIds.map((categoryId) => ({ id: categoryId })) } } : {}),
  };
}
