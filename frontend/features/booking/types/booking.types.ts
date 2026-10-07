/** Minimal booking contract used by the cart handoff (the full booking feature owns the rest). */

export interface BookingContact {
  fullName: string;
  phone: string;
}

export interface CreateBookingInput {
  tourId: string;
  departureId: string;
  participants: number;
  contact: BookingContact;
  notes?: string;
  promotionCode?: string;
  /** Optional retry key so a double submit never creates two bookings. */
  clientRequestId?: string;
}

export interface Booking {
  id: string;
  bookingCode: string;
  status: string;
  tour: { id: string; title: string };
  departureId: string;
  departureDate: string;
  endDate: string;
  participants: number;
  unitPrice: number;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  isPaid: boolean;
  paymentExpiresAt?: string;
  createdAt: string;
}

export interface BookingApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string; details?: unknown };
}
