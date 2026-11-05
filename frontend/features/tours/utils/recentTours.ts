import type { TourListItem } from '../types/tour.types';

const RECENT_TOURS_KEY = 'tripri_recently_viewed_tours';
const MAX_RECENT_TOURS = 24;

export interface RecentlyViewedTourRecord {
  tour: TourListItem;
  viewedAt: string;
}

export function getRecentlyViewedRecords(): RecentlyViewedTourRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_TOURS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item: any): RecentlyViewedTourRecord | null => {
        if (!item) return null;
        if (item.tour && typeof item.tour === 'object' && item.tour.id) {
          return {
            tour: item.tour,
            viewedAt: typeof item.viewedAt === 'string' ? item.viewedAt : new Date().toISOString(),
          };
        }
        if (item.id) {
          return {
            tour: item,
            viewedAt: new Date().toISOString(),
          };
        }
        return null;
      })
      .filter((rec): rec is RecentlyViewedTourRecord => rec !== null);
  } catch {
    return [];
  }
}

export function getRecentlyViewedTours(): TourListItem[] {
  return getRecentlyViewedRecords().map((rec) => rec.tour);
}

export function saveRecentlyViewedTour(tour: TourListItem): void {
  if (typeof window === 'undefined' || !tour?.id) return;
  try {
    const currentRecords = getRecentlyViewedRecords();
    const filtered = currentRecords.filter((rec) => rec.tour.id !== tour.id);
    const updated: RecentlyViewedTourRecord[] = [
      {
        tour,
        viewedAt: new Date().toISOString(),
      },
      ...filtered,
    ].slice(0, MAX_RECENT_TOURS);

    localStorage.setItem(RECENT_TOURS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('recent-tours-updated'));
  } catch {
    // Ignore quota errors
  }
}

export function removeRecentlyViewedTour(tourId: string): void {
  if (typeof window === 'undefined' || !tourId) return;
  try {
    const currentRecords = getRecentlyViewedRecords();
    const filtered = currentRecords.filter((rec) => rec.tour.id !== tourId);
    localStorage.setItem(RECENT_TOURS_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new CustomEvent('recent-tours-updated'));
  } catch {
    // Ignore quota errors
  }
}

export function clearRecentlyViewedTours(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(RECENT_TOURS_KEY);
    window.dispatchEvent(new CustomEvent('recent-tours-updated'));
  } catch {
    // Ignore errors
  }
}

export function formatMilestoneDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Gần đây';

  const dayNames = [
    'Chủ Nhật',
    'Thứ Hai',
    'Thứ Ba',
    'Thứ Tư',
    'Thứ Năm',
    'Thứ Sáu',
    'Thứ Bảy',
  ];

  const dayOfWeek = dayNames[date.getDay()];
  const day = date.getDate();
  const month = date.getMonth() + 1;

  return `${dayOfWeek}, ${day} tháng ${month}`;
}

export interface MilestoneGroup {
  dateLabel: string;
  records: RecentlyViewedTourRecord[];
}

export function groupRecentToursByMilestone(
  records: RecentlyViewedTourRecord[],
): MilestoneGroup[] {
  const groups: Record<string, RecentlyViewedTourRecord[]> = {};
  const order: string[] = [];

  for (const record of records) {
    const label = formatMilestoneDate(record.viewedAt);
    if (!groups[label]) {
      groups[label] = [];
      order.push(label);
    }
    groups[label].push(record);
  }

  return order.map((label) => ({
    dateLabel: label,
    records: groups[label],
  }));
}
