export function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
}

export function formatDuration(days: number): string {
  if (days <= 1) return '1 ngày';
  return `${days} ngày ${days - 1} đêm`;
}

export function formatDepartureDate(date?: string): string {
  if (!date) return 'Chưa có lịch khởi hành';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date));
}
