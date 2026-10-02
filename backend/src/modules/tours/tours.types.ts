import { GUIDE_ASSIGNMENT_STATUS, TOUR_STATUS, type GuideAssignmentStatus, type TourStatus } from '@travel-platform/constants';
import type { TransitionMap } from '../../utils/state-machine';
import type { CategoryDto } from '../categories';

const T = TOUR_STATUS;
/**
 * Tour lifecycle (DECISIONS D-14). Only the service changes `status`, always through assertTransition.
 *  agency:    DRAFT/REJECTED/SUSPENDED -> PENDING_REVIEW (submit), APPROVED -> PENDING_REVIEW (material edit), * -> ARCHIVED (delete)
 *  moderator: PENDING_REVIEW -> APPROVED | REJECTED, APPROVED -> SUSPENDED
 */
export const TOUR_TRANSITIONS: TransitionMap<TourStatus> = {
  [T.DRAFT]: [T.PENDING_REVIEW, T.ARCHIVED],
  [T.PENDING_REVIEW]: [T.APPROVED, T.REJECTED],
  [T.APPROVED]: [T.SUSPENDED, T.PENDING_REVIEW, T.ARCHIVED],
  [T.REJECTED]: [T.PENDING_REVIEW, T.ARCHIVED],
  [T.SUSPENDED]: [T.PENDING_REVIEW, T.ARCHIVED],
};

/** Statuses in which the owning agency may still edit the tour content. PENDING_REVIEW is locked while moderators review. */
export const AGENCY_EDITABLE_STATUSES: readonly TourStatus[] = [T.DRAFT, T.REJECTED, T.APPROVED, T.SUSPENDED];

const G = GUIDE_ASSIGNMENT_STATUS;
export const GUIDE_ASSIGNMENT_TRANSITIONS: TransitionMap<GuideAssignmentStatus> = {
  [G.PENDING]: [G.ACCEPTED, G.DECLINED],
};

export const TOUR_LIMITS = {
  MAX_IMPORT_BATCH: 50,
  MAX_DEPARTURES: 200,
  MAX_IMAGES: 20,
} as const;

// ---------------------------------------------------------------- inputs

export interface TourContentInput {
  title: string;
  summary?: string;
  description?: string;
  destination: string;
  durationDays: number;
  basePrice: number;
  maxGroupSize?: number;
  categoryIds: string[];
  images?: string[];
  inclusions?: string[];
  exclusions?: string[];
}

export type UpdateTourInput = Partial<TourContentInput>;

export interface DepartureInput {
  /** Present when editing an existing departure; omitted for a new one. */
  id?: string;
  date: Date;
  capacity: number;
  priceOverride?: number;
  isOpen: boolean;
}

export interface ItineraryDayInput {
  day: number;
  title: string;
  description?: string;
  activities?: string[];
}

export type TourSort = 'newest' | 'price_asc' | 'price_desc' | 'rating';

export interface SearchToursQuery {
  page: number;
  limit: number;
  q?: string;
  categoryId?: string;
  destination?: string;
  minPrice?: number;
  maxPrice?: number;
  minDays?: number;
  maxDays?: number;
  departureFrom?: Date;
  departureTo?: Date;
  minRating?: number;
  sort: TourSort;
}

export interface ListTourFilter {
  status?: TourStatus;
  q?: string;
  agencyId?: string;
}

// ------------------------------------------------------------------ DTOs

export interface DepartureDto {
  id: string;
  date: string;
  capacity: number;
  remaining: number;
  price: number;
  isOpen: boolean;
}

export interface TourAgencyDto {
  id: string;
  name: string;
  avatarUrl?: string;
}

/** Card in lists / search results. */
export interface TourListItemDto {
  id: string;
  title: string;
  summary?: string;
  destination: string;
  durationDays: number;
  basePrice: number;
  coverImage?: string;
  categoryIds: string[];
  ratingAvg: number;
  ratingCount: number;
  nextDepartureDate?: string;
  agency?: TourAgencyDto;
}

/** "View tour details". */
export interface TourDetailDto extends TourListItemDto {
  description?: string;
  maxGroupSize?: number;
  images: string[];
  inclusions: string[];
  exclusions: string[];
  itinerary: { day: number; title: string; description?: string; activities: string[] }[];
  departures: DepartureDto[];
  categories: CategoryDto[];
  guide?: { id: string; fullName: string; avatarUrl?: string };
}

/** What the owning agency / moderators see (adds workflow fields). */
export interface TourManageDto extends TourDetailDto {
  status: TourStatus;
  statusReason?: string;
  submittedAt?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
  guideAssignment?: {
    guideId: string;
    feePerBooking: number;
    status: GuideAssignmentStatus;
    respondedAt?: string;
    note?: string;
  };
}

/** What a tour guide sees for a tour assigned to them. */
export interface GuideTourDto {
  id: string;
  title: string;
  destination: string;
  durationDays: number;
  tourStatus: TourStatus;
  agencyId: string;
  agency?: TourAgencyDto;
  assignment: { feePerBooking: number; status: GuideAssignmentStatus; respondedAt?: string };
  nextDepartureDate?: string;
}

/** Minimal facts other modules (bookings, earnings, reviews) need about a tour. */
export interface BookableDeparture {
  tourId: string;
  agencyId: string;
  title: string;
  durationDays: number;
  departureId: string;
  departureDate: Date;
  unitPrice: number;
  remaining: number;
  guide?: { guideId: string; feePerBooking: number; status: GuideAssignmentStatus };
}
