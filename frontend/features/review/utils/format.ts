/** Vietnamese money/date formatting for the review UI (whole VND, `1.250.000 ₫`). */

const VND = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const DATE = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function formatVnd(amount: number): string {
  return `${VND.format(Math.round(amount))} ₫`;
}

/** `2026-02-01T…` -> `01/02/2026`. Empty string when the date is missing or unparsable. */
export function formatDate(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return DATE.format(date);
}

export function formatDuration(days: number): string {
  return days <= 1 ? '1 ngày' : `${days} ngày ${days - 1} đêm`;
}
