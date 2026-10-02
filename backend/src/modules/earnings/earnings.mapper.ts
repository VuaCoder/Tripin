import type { EarningDocument } from './earnings.model';
import type { EarningDto } from './earnings.types';

export function toEarningDto(earning: EarningDocument): EarningDto {
  return {
    id: earning.id,
    bookingId: String(earning.bookingId),
    bookingCode: earning.bookingCode,
    tour: { id: String(earning.tourId), title: earning.tourTitle },
    amount: earning.amount,
    earnedAt: earning.earnedAt.toISOString(),
  };
}
