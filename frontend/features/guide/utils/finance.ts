import type { EarningsRange, GuideSubscription } from '../types/finance';

export const formatGuideMoney = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
    amount,
  );
export const formatGuideDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(new Date(value))
    : '—';

/** Inclusive Vietnamese calendar dates, independent of the browser's timezone. */
export function earningsDateRange(from: string, to: string): EarningsRange {
  return {
    ...(from
      ? { from: new Date(`${from}T00:00:00.000+07:00`).toISOString() }
      : {}),
    ...(to ? { to: new Date(`${to}T23:59:59.999+07:00`).toISOString() } : {}),
  };
}

export function subscriptionLabel(
  subscription: GuideSubscription,
  now = Date.now(),
) {
  if (
    subscription.status === 'ACTIVE' &&
    subscription.startsAt &&
    new Date(subscription.startsAt).getTime() > now
  )
    return 'Đã thanh toán · Chờ hiệu lực';
  return {
    PENDING_PAYMENT: 'Chờ thanh toán',
    ACTIVE: 'Đã kích hoạt',
    EXPIRED: 'Đã hết hạn',
    CANCELLED: 'Đã hủy',
  }[subscription.status];
}
