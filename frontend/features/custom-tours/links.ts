import type { CustomTourRequestDto } from './types';

export type CustomTourRole = string | null | undefined;

type LinkableRequest = Pick<
  CustomTourRequestDto,
  'id' | 'nextStep' | 'conversationId' | 'currentBooking'
>;

const conversationHref = (requestId: string, conversationId: string, role?: CustomTourRole) =>
  `${role === 'AGENCY' ? '/agency/conversations' : '/conversations'}/${conversationId}?request=${requestId}`;

/** The chat (or the list) where the terms can be discussed again, whatever the next step is. */
export function customTourChatHref(
  request: Pick<CustomTourRequestDto, 'id' | 'conversationId'>,
  role?: CustomTourRole,
): string {
  return request.conversationId
    ? conversationHref(request.id, request.conversationId, role)
    : role === 'AGENCY' ? '/agency/custom-tours' : '/traveler/custom-tours';
}

/** Where the request's next step lives; `null` means there is nowhere to go. */
export function customTourHref(request: LinkableRequest, role?: CustomTourRole): string | null {
  const { id, nextStep, currentBooking } = request;

  if (nextStep === 'WAITING_AGENCY' || nextStep === 'NEGOTIATING' || nextStep === 'REVIEW_OFFER') {
    return customTourChatHref(request, role);
  }
  if (nextStep === 'ENTER_PASSENGERS') return `/traveler/bookings/new?customTourRequestId=${id}`;
  if (nextStep === 'PAY' || nextStep === 'DONE') {
    return currentBooking ? `/settings/history/${currentBooking.id}` : null;
  }
  return null;
}

export interface CustomTourNotification {
  type: string;
  data?: Record<string, string>;
}

/** Custom-tour notification deep link; `undefined` lets the caller keep its own fallback. */
export function notificationHref(
  notification: CustomTourNotification,
  role?: CustomTourRole,
): string | undefined {
  if (notification.type === 'BOOKING_COMPLETED' && notification.data?.bookingId) {
    return `/settings/history/${encodeURIComponent(notification.data.bookingId)}`;
  }
  if ((notification.type === 'TOUR_COMPLETION_DUE' || notification.type === 'TOUR_COMPLETION_OVERDUE') && notification.data?.tourId && notification.data?.departureId) {
    return `/agency/completions?tourId=${encodeURIComponent(notification.data.tourId)}&departureId=${encodeURIComponent(notification.data.departureId)}`;
  }
  if (!notification.type.startsWith('CUSTOM_TOUR')) return undefined;

  const { conversationId, requestId } = notification.data ?? {};
  if (conversationId) {
    const base = role === 'AGENCY' ? '/agency/conversations' : '/conversations';
    return requestId ? conversationHref(requestId, conversationId, role) : `${base}/${conversationId}`;
  }
  return role === 'AGENCY' ? '/agency/custom-tours' : '/traveler/custom-tours';
}
