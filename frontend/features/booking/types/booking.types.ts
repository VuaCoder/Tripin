export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export type BookingCancelReason = 'TRAVELER_REQUEST' | 'PAYMENT_EXPIRED';

export type PromotionScope = 'ORDER' | 'TOUR';

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
  contact: BookingContact;
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

/** Backward compatibility alias */
export type Booking = BookingDto;

export interface ListBookingsQuery {
  page?: number;
  limit?: number;
  status?: BookingStatus;
}

export interface PaginatedBookings {
  items: BookingDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CancelBookingInput {
  id: string;
  reason?: string;
}

export interface BookingPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface BookingApiResponse<T> {
  success: boolean;
  data: T;
  meta?: BookingPaginationMeta;
  error?: { code: string; message: string; details?: unknown };
}

