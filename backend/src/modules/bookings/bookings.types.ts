import type { AgePricing, BookingCancelReason, BookingStatus, GuestCounts, PassengerType, PromotionScope } from '@travel-platform/constants';

/** One member of a group booking, printed on the booking for its owner and the agency. */
export interface BookingPassengerDto {
  fullName: string;
  phone: string;
  idCard: string;
  guestType: PassengerType;
}

/**
 * Internal only: the frozen terms of an accepted group-booking offer, built by custom-tours from its snapshot.
 * It is never read from HTTP and it is what allows the booking to use a PRIVATE tour (`allowPrivate: true`).
 */
export interface CustomTourBookingInput {
  requestId: string;
  unitPrice: number;
  agePricing?: AgePricing | null;
  guestCounts: GuestCounts;
  passengers: BookingPassengerDto[];
}

export interface CreateBookingInput {
  passengers?: BookingPassenger[];
  premiumVoucherId?: string;
  guestCounts?: GuestCounts;
  tourId: string;
  departureId: string;
  participants: number;
  contact: { fullName: string; phone: string };
  notes?: string;
  promotionCode?: string;
  agencyPromotionCode?: string;
  platformPromotionCode?: string;
  clientRequestId?: string;
  customTour?: CustomTourBookingInput;
}

export interface BookingPassenger {
  fullName: string;
  birthYear?: number;
  ageGroup: 'ADULT' | 'CHILD' | 'INFANT';
  phone?: string;
  pickupPoint?: string;
  specialNotes?: string;
}

export interface ListBookingsQuery {
  page: number;
  limit: number;
  status?: BookingStatus;
}

export interface ListAgencyBookingsQuery extends ListBookingsQuery {
  tourId?: string;
  departureFrom?: Date;
  departureTo?: Date;
}

/** What the traveler sees. No commission data. */
export interface PromotionRedemptionDto {
  id: string;
  promotionId: string;
  scope: PromotionScope;
  code: string;
  discountAmount: number;
}

export interface BookingDto {
  premiumVoucherId?: string;
  guestPricing?: import('@travel-platform/constants').GuestPriceBreakdown;
  id: string;
  bookingCode: string;
  status: BookingStatus;
  tour: { id: string; title: string; coverImage?: string };
  departureId: string;
  departureDate: string;
  endDate: string;
  participants: number;
  unitPrice: number;
  subtotal: number;
  discountAmount: number;
  promotion?: { code: string; scope: PromotionScope; discountAmount: number };
  redemptions?: PromotionRedemptionDto[];
  totalAmount: number;
  contact: { fullName: string; phone: string };
  /** Detail only: the named members of a group booking. Lists omit them. */
  passengers?: BookingPassengerDto[];
  notes?: string;
  isPaid: boolean;
  refundRequired: boolean;
  paymentExpiresAt?: string;
  confirmedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelReason?: BookingCancelReason;
  /** Set when the booking came from an accepted group offer; the detail page can offer to book again from it. */
  customTourRequestId?: string;
  createdAt: string;
  review?: import('./bookings.repository').BookingReviewSnapshot;
}

/** "View bookings status" for agencies: money split included, traveler contact only once the booking is confirmed. */
export interface AgencyBookingDto {
  id: string;
  bookingCode: string;
  status: BookingStatus;
  tour: { id: string; title: string };
  departureId: string;
  departureDate: string;
  participants: number;
  totalAmount: number;
  commissionAmount: number;
  agencyAmount: number;
  isPaid: boolean;
  traveler?: { fullName: string; phone: string };
  /** Detail only, and shared after confirmation. */
  passengers?: (BookingPassenger | BookingPassengerDto)[];
  notes?: string;
  createdAt: string;
  confirmedAt?: string;
  cancelledAt?: string;
}

/** Minimal immutable facts other modules (payments, e-tickets, earnings, reviews) need about a booking. */
export interface BookingFacts {
  id: string;
  bookingCode: string;
  status: BookingStatus;
  travelerId: string;
  agencyId: string;
  tourId: string;
  tourTitle: string;
  departureId: string;
  departureDate: Date;
  endDate: Date;
  participants: number;
  /** Name given as the traveler contact on the booking (printed on the e-ticket). */
  contactName: string;
  totalAmount: number;
  commissionAmount: number;
  agencyAmount: number;
}

/** The one live booking of a group request; custom-tours shows it as `currentBooking` and derives `nextStep` from it. */
export interface ActiveCustomTourBooking {
  id: string;
  status: BookingStatus;
  bookingCode: string;
  isPaid: boolean;
}

export interface PayableBooking {
  bookingId: string;
  bookingCode: string;
  description: string;
  amount: number;
  expiresAt: Date;
}

export type PaymentConfirmationOutcome = 'CONFIRMED' | 'ALREADY_CONFIRMED' | 'REFUND_REQUIRED';

// ------------------------------------------------------------------ dashboard read models

export interface RevenueTotals {
  /** Paid bookings (CONFIRMED + COMPLETED). */
  bookings: number;
  gross: number;
  commission: number;
  /** What the agencies receive (gross - commission). */
  net: number;
}

export interface AgencyBookingStats {
  /** Distinct travelers with CONFIRMED/COMPLETED bookings, lifetime, agency-scoped. */
  customers: number;
  byStatus: Record<string, number>;
  totals: RevenueTotals;
  /** Paid bookings per day (UTC) over the last 30 days, oldest first, days without sales omitted. */
  last30Days: { date: string; bookings: number; net: number }[];
  last6Months: { month: string; bookings: number; net: number }[];
  topTours: { tourId: string; title: string; coverImage: string | null; bookings: number; net: number }[];
}

export interface PlatformBookingStats {
  byStatus: Record<string, number>;
  totals: RevenueTotals;
  /** Paid bookings per month (UTC) over the last 12 months, oldest first. */
  monthly: { month: string; bookings: number; gross: number; commission: number }[];
}

/** One row of the agency's customer list (paid bookings only). */
export interface CustomerRow {
  bookingCode: string;
  departureDate: Date;
  travelerName: string;
  phone: string;
  participants: number;
  notes?: string;
  birthYear?: number;
  ageGroup?: BookingPassenger['ageGroup'];
  pickupPoint?: string;
  specialNotes?: string;
}

export const CUSTOMER_EXPORT_LIMIT = 5000;
