export interface DateSelection { from: string; to: string }
export function dateSelectionError(value: DateSelection, maxDays?: number): string | null {
  if (!value.from && !value.to) return null;
  if (!value.from || !value.to) return 'Vui lòng chọn đủ ngày bắt đầu và kết thúc.';
  const from = new Date(`${value.from}T00:00:00+07:00`);
  const to = new Date(`${value.to}T23:59:59.999+07:00`);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to) return 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.';
  if (maxDays && to.getTime() - from.getTime() >= maxDays * 86400000) return `Chọn khoảng thời gian tối đa ${maxDays} ngày.`;
  return null;
}
/** Inclusive Vietnam calendar dates, independent of the browser timezone. */
export function dateSelectionQuery(value: DateSelection): { from?: string; to?: string } {
  return value.from && value.to ? {
    from: new Date(`${value.from}T00:00:00.000+07:00`).toISOString(),
    to: new Date(`${value.to}T23:59:59.999+07:00`).toISOString(),
  } : {};
}
export function recentDays(days: number, now = new Date()): DateSelection {
  const vietnamDate = new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);
  const end = new Date(`${vietnamDate}T00:00:00Z`);
  return { from: new Date(end.getTime() - (days - 1) * 86400000).toISOString().slice(0, 10), to: vietnamDate };
}
export function normalizedSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}
