export interface TourItineraryContent {
  day: number;
  toDay?: number | null;
  title: string;
  description?: string | null;
  activities?: string[];
}

export function itineraryCoveredDays(days: readonly TourItineraryContent[], duration: number): number[] {
  if (!Number.isInteger(duration) || duration < 1 || duration > 365) return [];
  return Array.from({ length: duration }, (_, i) => i + 1).filter(n => days.some(d => n >= d.day && n <= (d.toDay ?? d.day)));
}

/** Partial valid programs can be saved as drafts; submissions must cover the full duration. */
export function validateTourItinerary(days: readonly TourItineraryContent[], duration: number, complete = false): { message: string; index?: number; field?: 'day' | 'title' | 'description' | 'activities' } | undefined {
  if (!Number.isInteger(duration) || duration < 1 || duration > 365) return { message: 'Chọn thời lượng tour từ 1 đến 365 ngày trước khi soạn lịch trình.' };
  if (days.length > 365) return { message: 'Lịch trình có tối đa 365 mục.' };
  const sorted = days.map((d, index) => ({ ...d, index })).sort((a, b) => a.day - b.day);
  for (let i = 0; i < sorted.length; i++) {
    const d = sorted[i];
    if (!d) continue;
    const end = d.toDay ?? d.day;
    if (!Number.isInteger(d.day) || !Number.isInteger(end) || d.day < 1 || end < d.day || end > duration) return { index: d.index, field: 'day', message: `Mục ${d.index + 1}: chọn ngày trong khoảng 1–${duration}, ngày kết thúc không trước ngày bắt đầu.` };
    if (d.title.trim().length < 2 || d.title.trim().length > 200) return { index: d.index, field: 'title', message: `Ngày ${d.day}: nhập tiêu đề từ 2 đến 200 ký tự.` };
    if ((d.description?.length ?? 0) > 5000) return { index: d.index, field: 'description', message: `Ngày ${d.day}: nội dung tối đa 5.000 ký tự.` };
    if ((d.activities?.length ?? 0) > 30 || d.activities?.some(a => !a.trim() || a.length > 300)) return { index: d.index, field: 'activities', message: `Ngày ${d.day}: tối đa 30 hoạt động, mỗi hoạt động từ 1 đến 300 ký tự.` };
    const previous = sorted[i - 1];
    if (previous && d.day <= (previous.toDay ?? previous.day)) return { index: d.index, field: 'day', message: `Ngày ${d.day} bị trùng với mục lịch trình khác.` };
  }
  if (complete) {
    const covered = itineraryCoveredDays(days, duration);
    const missing = Array.from({ length: duration }, (_, i) => i + 1).filter(n => !covered.includes(n));
    if (missing.length) return { message: `Bổ sung lịch trình ngày ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''} trước khi gửi duyệt. Bạn vẫn có thể lưu bản nháp.` };
  }
}
