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

/**
 * Định dạng ngày thông minh chuẩn hệ thống:
 * - Cùng năm hiện tại: DD/MM
 * - Khác năm hiện tại: DD/MM/YY
 */
export function formatSmartDate(isoOrDate?: string | Date | null): string {
  if (!isoOrDate) return '—';
  const date = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) return '—';

  const now = new Date();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');

  if (date.getFullYear() === now.getFullYear()) {
    return `${day}/${month}`;
  }
  const yearShort = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${yearShort}`;
}

/**
 * Định dạng ngày giờ thông minh chuẩn hệ thống:
 * - Cùng năm hiện tại: HH:MM - DD/MM
 * - Khác năm hiện tại: HH:MM - DD/MM/YY
 */
export function formatSmartDateTime(isoOrDate?: string | Date | null): string {
  if (!isoOrDate) return '—';
  const date = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) return '—';

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const datePart = formatSmartDate(date);
  return `${hours}:${minutes} - ${datePart}`;
}
