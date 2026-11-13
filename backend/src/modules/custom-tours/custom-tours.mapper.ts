import { CUSTOM_TOUR_STATUS, type CustomTourStatus, type GuestCounts } from '@travel-platform/constants';
import type { TourBrief } from '../tours';
import type {
  CustomTourCheckoutDraft,
  CustomTourNextStep,
  CustomTourOffer,
  CustomTourRequestDto,
} from './custom-tours.types';
import type { CustomTourRecord } from './custom-tours.repository';

const NEXT_STEP: Record<CustomTourStatus, CustomTourNextStep> = {
  [CUSTOM_TOUR_STATUS.SUBMITTED]: 'WAITING_AGENCY',
  [CUSTOM_TOUR_STATUS.NEGOTIATING]: 'NEGOTIATING',
  [CUSTOM_TOUR_STATUS.OFFERED]: 'REVIEW_OFFER',
  [CUSTOM_TOUR_STATUS.ACCEPTED]: 'ENTER_PASSENGERS',
  [CUSTOM_TOUR_STATUS.DECLINED]: 'CLOSED',
  [CUSTOM_TOUR_STATUS.CANCELLED]: 'CLOSED',
};

/** Maps a request row plus the tour facts it points at. Money fields are the frozen snapshot, never recomputed here. */
export function toCustomTourRequestDto(
  record: CustomTourRecord,
  briefs: Map<string, TourBrief>,
  currentBooking?: CustomTourRequestDto['currentBooking'],
): CustomTourRequestDto {
  const status = record.status as CustomTourStatus;
  const source = briefs.get(record.sourceTourId);
  const privateTour = record.privateTourId ? briefs.get(record.privateTourId) : undefined;
  return {
    id: record.id,
    status,
    revision: record.revision,
    participants: record.participants,
    startDate: record.startDate?.toISOString(),
    guestCounts: (record.guestCounts as unknown as GuestCounts | null) ?? undefined,
    notes: record.notes ?? undefined,
    sourceTour: source ? { id: source.id, title: source.title, images: source.images } : undefined,
    privateTour: privateTour ? { id: privateTour.id, title: privateTour.title, status: privateTour.status } : undefined,
    offer: (record.offerSnapshot as unknown as CustomTourOffer | null) ?? undefined,
    checkoutDraft: (record.checkoutDraft as unknown as CustomTourCheckoutDraft | null) ?? undefined,
    checkoutRevision: record.checkoutRevision,
    conversationId: record.conversationId ?? undefined,
    currentBooking,
    // A live booking is the next thing to do, whatever the request's own status says.
    nextStep: currentBooking ? (currentBooking.isPaid ? 'DONE' : 'PAY') : NEXT_STEP[status],
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
