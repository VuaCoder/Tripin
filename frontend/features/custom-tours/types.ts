import type { AgePricing, CustomTourStatus, GuestCounts, PassengerType } from '@travel-platform/constants';
import type { TourContentInput } from '@/features/tours/types';

export type { AgePricing, CustomTourStatus, GuestCounts, PassengerType };

/** What the traveler can do next, derived by the backend from status and existing artifacts. */
export type CustomTourNextStep =
  | 'WAITING_AGENCY'
  | 'NEGOTIATING'
  | 'REVIEW_OFFER'
  | 'ENTER_PASSENGERS'
  | 'PAY'
  | 'DONE'
  | 'CLOSED';

export type CustomTourDecision = 'ACCEPT' | 'DECLINE' | 'CANCEL';

/** The tour content frozen with the offer; the panel shows exactly what the agency sent. */
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

/** The frozen terms the agency offered; money fields are snapshots, never recomputed on the client. */
export interface CustomTourOffer {
  revision: number;
  unitPrice: number;
  agePricing?: AgePricing | null;
  guestCounts: GuestCounts;
  subtotal: number;
  departureDate: string;
  sentAt: string;
  /** Absent on offers sent before the content was frozen; the panel then shows the price only. */
  content?: CustomTourOfferContent;
}

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

export interface CustomTourSourceTour {
  id: string;
  title: string;
  images: string[];
}

export interface CustomTourPrivateTour {
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
  sourceTour?: CustomTourSourceTour;
  privateTour?: CustomTourPrivateTour;
  offer?: CustomTourOffer;
  checkoutDraft?: CustomTourCheckoutDraft;
  /** The revision the saved form belongs to; the client echoes it back on the next save. */
  checkoutRevision: number;
  conversationId?: string;
  currentBooking?: { id: string; status: string; bookingCode: string; isPaid: boolean };
  nextStep: CustomTourNextStep;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomTourInput {
  sourceTourId: string;
  participants: number;
  guestCounts?: GuestCounts;
  /** ISO instant of the day the group wants to start. */
  startDate?: string;
  notes?: string;
  clientRequestId?: string;
}

export interface ListCustomToursArgs {
  page?: number;
  limit?: number;
  status?: CustomTourStatus;
  conversationId?: string;
}

/** The fields the agency may negotiate; `maxGroupSize` is always the head count, so the API refuses it. */
export type CustomTourDraftContent = Partial<Omit<TourContentInput, 'maxGroupSize'>>;

export interface CustomTourDraftInput {
  id: string;
  /** The revision the editor was rendered from; a stale one is refused with 409. */
  revision: number;
  content?: CustomTourDraftContent;
  guestCounts?: GuestCounts;
  departure?: { date: string; capacity?: number };
}

/** Revision of the offer being accepted or sent. */
export type CustomTourOfferAction = { id: string; revision: number };

/** The resumable passenger form; `checkoutRevision` is the form's own counter, not the offer's. */
export type CustomTourCheckoutInput = CustomTourCheckoutDraft & { checkoutRevision: number };

export interface CustomTourListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CustomTourListResult {
  items: CustomTourRequestDto[];
  meta: CustomTourListMeta;
}
