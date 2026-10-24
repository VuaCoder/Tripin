import { useEffect, useState } from 'react';

export const clockTime = (value: string) => new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
export const fullTime = (value: string) => new Date(value).toLocaleString('vi-VN');
export const sameDay = (a: string | Date, b: string | Date) => new Date(a).toDateString() === new Date(b).toDateString();
const calendarDate = (date: Date, year: boolean) => `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}${year ? `/${date.getFullYear()}` : ''}`;

export function dayLabel(value: string, now = new Date()) {
  if (sameDay(value, now)) return 'Hôm nay';
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  if (sameDay(value, yesterday)) return 'Hôm qua';
  return calendarDate(new Date(value), true);
}

export function inboxTime(value: string, now = new Date()) {
  if (sameDay(value, now)) return clockTime(value);
  if (dayLabel(value, now) === 'Hôm qua') return 'Hôm qua';
  const date = new Date(value);
  return calendarDate(date, date.getFullYear() !== now.getFullYear());
}

export function preview(value: string) {
  return value.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '').replace(/(^|\n)\s*(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+)/g, '$1')
    .replace(/[*_`~]/g, '').replace(/\s+/g, ' ').trim();
}

export function useChatClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = setInterval(update, 60_000);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, []);
  return now;
}

export function useOfflineRefresh(connected: boolean, refresh: () => unknown) {
  useEffect(() => {
    if (connected) return;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 30_000);
    return () => clearInterval(timer);
  }, [connected, refresh]);
}
