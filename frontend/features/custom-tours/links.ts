import type { CustomTourRequestDto } from './types';

export type CustomTourRole = string | null | undefined;

type LinkableRequest = Pick<
  CustomTourRequestDto,
  'id' | 'nextStep' | 'conversationId' | 'currentBooking'
>;

const conversationHref = (requestId: string, conversationId: string) =>
  `/conversations/${conversationId}?request=${requestId}`;

/** The chat (or the list) where the terms can be discussed again, whatever the next step is. */
export function customTourChatHref(
  request: Pick<CustomTourRequestDto, 'id' | 'conversationId'>,
  role?: CustomTourRole,
): string {
  return request.conversationId
    ? conversationHref(request.id, request.conversationId)
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
  if (!notification.type.startsWith('CUSTOM_TOUR')) return undefined;

  const { conversationId, requestId } = notification.data ?? {};
  if (conversationId) {
    return requestId ? conversationHref(requestId, conversationId) : `/conversations/${conversationId}`;
  }
  return role === 'AGENCY' ? '/agency/custom-tours' : '/traveler/custom-tours';
}
