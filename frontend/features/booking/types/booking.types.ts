export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export type BookingCancelReason = 'TRAVELER_REQUEST' | 'PAYMENT_EXPIRED';

export type PromotionScope = 'ORDER' | 'TOUR' | 'AGENCY' | 'PLATFORM';

export interface BookingContact {
  fullName: string;
  phone: string;
}

export interface CreateBookingInput {
  guestCounts?: import('@travel-platform/constants').GuestCounts;
  tourId: string;
  departureId: string;
  participants: number;
  contact: BookingContact;
  notes?: string;
  promotionCode?: string;
  agencyPromotionCode?: string;
  platformPromotionCode?: string;
  /** Optional retry key so a double submit never creates two bookings. */
  clientRequestId?: string;
}

export interface AvailablePromotionItem {
  id: string;
  scope?: PromotionScope;
  ownerId?: string;
  code?: string;
  title: string;
  description?: string;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderAmount: number;
  applyType?: 'CODE' | 'AUTO_APPLY' | 'COLLECTABLE';
  codeType?: 'SHARED' | 'UNIQUE_BATCH';
  minParticipants?: number;
  daysInAdvance?: number;
  firstBookingOnly?: boolean;
  targetTourIds?: string[];
  startsAt: string;
  endsAt: string;
  usageLimit?: number;
  usedCount: number;
  isActive: boolean;
  isRunning: boolean;
  isArchived?: boolean;
}

export interface AvailablePromotions {
  platform: AvailablePromotionItem[];
  agency: AvailablePromotionItem[];
  autoAgency?: AvailablePromotionItem;
  autoPlatform?: AvailablePromotionItem;
}

export interface UserVoucherItem {
  id: string;
  userId: string;
  promotionId: string;
  collectedAt: string;
  isUsed: boolean;
  usedAt?: string;
  bookingId?: string;
  promotion?: AvailablePromotionItem;
}

/** Input for the non-mutating promotion estimate endpoint. */
export interface PromotionPreviewInput {
  code: string;
  tourId: string;
  subtotal: number;
}

/** The discount and amount the backend currently estimates for a promotion. */
export interface PromotionPreview {
  promotionId: string;
  code: string;
  scope: PromotionScope;
  discountAmount: number;
  finalAmount: number;
}

export type AppliedPromotionPreview = PromotionPreview;
export type AvailablePromotionsDto = AvailablePromotions;

export interface BookingDto {
  guestPricing?: import('@travel-platform/constants').GuestPriceBreakdown;
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

