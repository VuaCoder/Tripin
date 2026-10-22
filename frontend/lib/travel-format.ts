/** Shared Vietnamese money/date formatting for tours, bookings and tickets (whole VND, `1.250.000 ₫`). */

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

/** Định dạng số tiền có dấu chấm phân cách hàng nghìn khi người dùng gõ vào ô input (VD: 50000 -> "50.000") */
export function formatCurrencyVndInput(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '';
  if (typeof val === 'number' && val === 0) return '';
  const digits = typeof val === 'number' ? Math.round(val).toString() : val.toString().replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Tách lấy số nguyên từ chuỗi tiền tệ có dấu chấm/phẩy */
export function parseCurrencyVndInput(raw: string): number {
  const digits = raw.replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 0;
}
