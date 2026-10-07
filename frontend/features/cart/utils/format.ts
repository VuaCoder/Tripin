/** Vietnamese money/date formatting used by the cart UI (whole VND, `1.250.000 ₫`). */

const VND = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

export function formatVnd(amount: number): string {
  return `${VND.format(Math.round(amount))} ₫`;
}

export function formatDepartureDate(iso?: string): string {
  if (!iso) return 'Chưa có ngày khởi hành';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Chưa có ngày khởi hành';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

export function formatDuration(days: number): string {
  return days <= 1 ? '1 ngày' : `${days} ngày ${days - 1} đêm`;
}

export function formatParticipants(count: number): string {
  return `${count} khách`;
}
