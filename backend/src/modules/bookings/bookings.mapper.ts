import { BOOKING_STATUS, type BookingCancelReason, type BookingStatus, type PromotionScope } from '@travel-platform/constants';
import type { BookingDocument } from './bookings.model';
import type { AgencyBookingDto, BookingDto, BookingFacts } from './bookings.types';

const iso = (date?: Date | null) => date?.toISOString();
const createdAtOf = (booking: BookingDocument) => (booking as unknown as { createdAt: Date }).createdAt.toISOString();

export function toBookingDto(booking: BookingDocument): BookingDto {
  return {
    id: booking.id,
    bookingCode: booking.bookingCode,
    status: booking.status as BookingStatus,
    tour: { id: String(booking.tourId), title: booking.tourTitle },
    departureId: String(booking.departureId),
    departureDate: booking.departureDate.toISOString(),
    endDate: booking.endDate.toISOString(),
    participants: booking.participants,
    unitPrice: booking.unitPrice,
    subtotal: booking.subtotal,
    discountAmount: booking.discountAmount ?? 0,
    promotion: booking.promotion
      ? { code: booking.promotion.code, scope: booking.promotion.scope as PromotionScope, discountAmount: booking.promotion.discountAmount }
      : undefined,
    totalAmount: booking.totalAmount,
    contact: { fullName: booking.contact.fullName, phone: booking.contact.phone },
    notes: booking.notes ?? undefined,
    isPaid: booking.isPaid,
    refundRequired: booking.refundRequired,
    paymentExpiresAt: iso(booking.paymentExpiresAt),
    confirmedAt: iso(booking.confirmedAt),
    completedAt: iso(booking.completedAt),
    cancelledAt: iso(booking.cancelledAt),
    cancelReason: (booking.cancelReason as BookingCancelReason | undefined) ?? undefined,
    createdAt: createdAtOf(booking),
  };
}

/** Traveler contact details are shared with the agency only once the booking is paid (CONFIRMED / COMPLETED). */
export function toAgencyBookingDto(booking: BookingDocument): AgencyBookingDto {
  const shareContact = booking.status === BOOKING_STATUS.CONFIRMED || booking.status === BOOKING_STATUS.COMPLETED;
  return {
    id: booking.id,
    bookingCode: booking.bookingCode,
    status: booking.status as BookingStatus,
    tour: { id: String(booking.tourId), title: booking.tourTitle },
    departureId: String(booking.departureId),
    departureDate: booking.departureDate.toISOString(),
    participants: booking.participants,
    totalAmount: booking.totalAmount,
    commissionAmount: booking.commissionAmount,
    agencyAmount: booking.agencyAmount,
    isPaid: booking.isPaid,
    traveler: shareContact ? { fullName: booking.contact.fullName, phone: booking.contact.phone } : undefined,
    notes: shareContact ? (booking.notes ?? undefined) : undefined,
    createdAt: createdAtOf(booking),
    confirmedAt: iso(booking.confirmedAt),
    cancelledAt: iso(booking.cancelledAt),
  };
}

export function toBookingFacts(booking: BookingDocument): BookingFacts {
  return {
    id: booking.id,
    bookingCode: booking.bookingCode,
    status: booking.status as BookingStatus,
    travelerId: String(booking.travelerId),
    agencyId: String(booking.agencyId),
    tourId: String(booking.tourId),
    tourTitle: booking.tourTitle,
    departureId: String(booking.departureId),
    departureDate: booking.departureDate,
    participants: booking.participants,
    contactName: booking.contact.fullName,
    totalAmount: booking.totalAmount,
    commissionAmount: booking.commissionAmount,
    agencyAmount: booking.agencyAmount,
  };
}
