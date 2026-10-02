import type { BookingCancelReason, BookingStatus, PromotionScope } from '@travel-platform/constants';

export interface CreateBookingInput {
  tourId: string;
  departureId: string;
  participants: number;
  contact: { fullName: string; phone: string };
  notes?: string;
  promotionCode?: string;
  clientRequestId?: string;
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
export interface BookingDto {
  id: string;
  bookingCode: string;
  status: BookingStatus;
  tour: { id: string; title: string };
  departureId: string;
  departureDate: string;
  endDate: string;
  participants: number;
  unitPrice: number;
  subtotal: number;
  discountAmount: number;
  promotion?: { code: string; scope: PromotionScope; discountAmount: number };
  totalAmount: number;
  contact: { fullName: string; phone: string };
  notes?: string;
  isPaid: boolean;
  refundRequired: boolean;
  paymentExpiresAt?: string;
  confirmedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelReason?: BookingCancelReason;
  createdAt: string;
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
  participants: number;
  /** Name given as the traveler contact on the booking (printed on the e-ticket). */
  contactName: string;
  totalAmount: number;
  commissionAmount: number;
  agencyAmount: number;
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
  byStatus: Record<string, number>;
  totals: RevenueTotals;
  /** Paid bookings per day (UTC) over the last 30 days, oldest first, days without sales omitted. */
  last30Days: { date: string; bookings: number; net: number }[];
  topTours: { tourId: string; title: string; bookings: number; net: number }[];
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
}

export const CUSTOMER_EXPORT_LIMIT = 5000;
