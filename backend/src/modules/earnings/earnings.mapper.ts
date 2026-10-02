import type { EarningRecord } from './earnings.repository';
import type { EarningDto } from './earnings.types';

export function toEarningDto(earning: EarningRecord): EarningDto {
  return {
    id: earning.id,
    bookingId: earning.bookingId,
    bookingCode: earning.bookingCode,
    tour: { id: earning.tourId, title: earning.tourTitle },
    amount: earning.amount,
    earnedAt: earning.earnedAt.toISOString(),
  };
}
