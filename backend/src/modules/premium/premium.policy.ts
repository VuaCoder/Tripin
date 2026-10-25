import { AppError } from '../../utils/app-error';

export interface VoucherTerms {
  title: string;
  agencyId: string;
  tourIds: string[];
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount: number;
}
export interface PremiumPeriod {
  startsAt: Date | null;
  endsAt: Date | null;
  revokedAt?: Date | null;
}

export function continuousPremiumEnd(
  periods: PremiumPeriod[],
  now = new Date(),
): Date | null {
  const ordered = periods
    .filter((p) => !p.revokedAt && p.startsAt && p.endsAt && p.endsAt > now)
    .sort((a, b) => a.startsAt!.getTime() - b.startsAt!.getTime());
  let end: Date | null = null;
  for (const p of ordered) {
    if (!end && p.startsAt! <= now) end = p.endsAt;
    else if (end && p.startsAt! <= end && p.endsAt! > end) end = p.endsAt;
  }
  return end;
}

export function premiumDiscount(
  terms: VoucherTerms,
  agencyId: string,
  tourId: string,
  subtotal: number,
): number {
  if (
    terms.agencyId !== agencyId ||
    !terms.tourIds.includes(tourId) ||
    subtotal < terms.minOrderAmount
  )
    throw AppError.conflict(
      'Voucher không áp dụng cho tour hoặc giá trị đơn này',
    );
  const amount =
    terms.discountType === 'PERCENT'
      ? Math.min(
          Math.floor((subtotal * terms.discountValue) / 100),
          terms.maxDiscountAmount ?? subtotal,
        )
      : terms.discountValue;
  return Math.min(amount, subtotal);
}

export function assertRefundable(
  period: PremiumPeriod,
  now = new Date(),
): void {
  if (period.revokedAt || !period.startsAt || period.startsAt <= now)
    throw AppError.conflict(
      'Chỉ được hoàn kỳ đã thanh toán nhưng chưa bắt đầu',
    );
}
