import { CUSTOM_TOUR_STATUS, type CustomTourStatus, type GuestCounts, type PassengerType } from '@travel-platform/constants';
import type { TransitionMap } from '../../utils/state-machine';
import type { BookingDto } from '../bookings/bookings.types';
import type { TourContentInput } from '../tours/tours.types';

const S = CUSTOM_TOUR_STATUS;

/** Every status change goes through `assertTransition`. S5/S6 add the rest of the negotiation edges. */
export const CUSTOM_TOUR_TRANSITIONS: TransitionMap<CustomTourStatus> = {
  [S.SUBMITTED]: [S.NEGOTIATING, S.DECLINED, S.CANCELLED],
  [S.NEGOTIATING]: [S.OFFERED],
  [S.OFFERED]: [S.NEGOTIATING, S.ACCEPTED],
};

/** Agency answers a fresh request; the traveler may withdraw one that has not been answered yet. */
export type CustomTourDecision = 'ACCEPT' | 'DECLINE' | 'CANCEL';

/** What the traveler can do next, derived from the request status and what already exists (S10 adds PAY/DONE). */
export type CustomTourNextStep =
  | 'WAITING_AGENCY'
  | 'NEGOTIATING'
  | 'REVIEW_OFFER'
  | 'ENTER_PASSENGERS'
  | 'PAY'
  | 'DONE'
  | 'CLOSED';

/** The tour content frozen with the offer, so the traveler reads exactly what the agency sent. */
export type CustomTourOfferContent = Pick<
  TourContentInput,
  | 'title'
  | 'destination'
  | 'durationDays'
  | 'summary'
  | 'description'
  | 'inclusions'
  | 'exclusions'
  | 'childPricingPolicy'
  | 'cancellationPolicy'
  | 'travelNotes'
  | 'requiredDocuments'
>;

/** The frozen terms the agency offered; the traveler accepts exactly one revision. */
export interface CustomTourOffer {
  revision: number;
  unitPrice: number;
  agePricing?: unknown;
  guestCounts: GuestCounts;
  subtotal: number;
  departureDate: string;
  sentAt: string;
  /** Absent on offers sent before the content was frozen; the panel then shows the price only. */
  content?: CustomTourOfferContent;
}

/** One member, as saved in the resumable checkout form. */
export interface CustomTourPassengerDraft {
  fullName: string;
  phone: string;
  idCard: string;
  guestType: PassengerType;
}

export interface CustomTourCheckoutDraft {
  contact: { fullName: string; phone: string };
  passengers: CustomTourPassengerDraft[];
  notes?: string;
}

/** The traveler's checkout form, guarded by its own revision so two devices never silently overwrite each other. */
export interface SaveCustomTourCheckoutInput extends CustomTourCheckoutDraft {
  checkoutRevision: number;
}

export interface CustomTourSourceTourDto {
  id: string;
  title: string;
  images: string[];
}

export interface CustomTourPrivateTourDto {
  id: string;
  title: string;
  status: string;
}

export interface CustomTourRequestDto {
  id: string;
  status: CustomTourStatus;
  revision: number;
  participants: number;
  /** ISO instant of the day the group wants to start, when it asked for one. */
  startDate?: string;
  guestCounts?: GuestCounts;
  notes?: string;
  sourceTour?: CustomTourSourceTourDto;
  privateTour?: CustomTourPrivateTourDto;
  offer?: CustomTourOffer;
  checkoutDraft?: CustomTourCheckoutDraft;
  /** The revision the saved form belongs to; the client echoes it back on the next save. */
  checkoutRevision: number;
  conversationId?: string;
  /** The live booking this request produced; its presence moves `nextStep` to PAY or DONE. */
  currentBooking?: { id: string; status: string; bookingCode: string; isPaid: boolean };
  nextStep: CustomTourNextStep;
  createdAt: string;
  updatedAt: string;
}

/** Content the agency may change from the request. `maxGroupSize` is absent on purpose: it always equals participants. */
export type CustomTourDraftContent = Partial<Omit<TourContentInput, 'maxGroupSize'>>;

export interface SaveCustomTourDraftInput {
  revision: number;
  content?: CustomTourDraftContent;
  guestCounts?: GuestCounts;
  departure?: { date: Date; capacity?: number };
}

export interface CreateCustomTourInput {
  sourceTourId: string;
  participants: number;
  guestCounts?: GuestCounts;
  startDate?: Date;
  notes?: string;
  clientRequestId?: string;
}

/** `created` is false when the request already had a live booking and it was returned instead of a new one. */
export interface CustomTourBookingResult {
  booking: BookingDto;
  created: boolean;
}

export interface ListCustomToursQuery {
  page: number;
  limit: number;
  status?: CustomTourStatus;
  conversationId?: string;
}
