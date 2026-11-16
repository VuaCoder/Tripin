import type { CustomTourRequestDto, CustomTourStatus } from './types';

export const STATUS_LABELS: Record<CustomTourStatus, { label: string; className: string }> = {
  SUBMITTED: { label: 'Chờ đại lý phản hồi', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  NEGOTIATING: { label: 'Đang thương lượng', className: 'border-blue-200 bg-blue-50 text-blue-800' },
  OFFERED: { label: 'Đã gửi thỏa thuận', className: 'border-indigo-200 bg-indigo-50 text-indigo-800' },
  ACCEPTED: { label: 'Đã chấp nhận', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  DECLINED: { label: 'Đại lý từ chối', className: 'border-rose-200 bg-rose-50 text-rose-800' },
  CANCELLED: { label: 'Đã hủy', className: 'border-slate-200 bg-slate-100 text-slate-600' },
};

/** "6 người · 3 người lớn, 3 trẻ em" — the composition the traveler entered, when it is known. */export function guestSummary(request: Pick<CustomTourRequestDto, 'participants' | 'guestCounts'>): string {
  const total = `${request.participants} người`;
  const counts = request.guestCounts;
  if (!counts) return total;
  const parts = [`${counts.adults} người lớn`];
  if (counts.children) parts.push(`${counts.children} trẻ em`);
  if (counts.infants) parts.push(`${counts.infants} em bé`);
  return `${total} · ${parts.join(', ')}`;
}

const vnDay = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' });
const vnTime = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false });

export const dayLabel = (iso?: string): string | undefined => (iso ? vnDay.format(new Date(iso)) : undefined);

/** "20/05/2026 · 08:30" on the Vietnam clock: the departure both sides agreed on. */
export const departureLabel = (iso?: string): string | undefined => {
  const day = dayLabel(iso);
  return day ? `${day} · ${vnTime.format(new Date(iso!))}` : undefined;
};
