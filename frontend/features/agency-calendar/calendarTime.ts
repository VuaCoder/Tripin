import { Temporal } from 'temporal-polyfill';

export const CALENDAR_ZONE = 'Asia/Ho_Chi_Minh';
export function localParts(instant: string) {
  const value = Temporal.Instant.from(instant).toZonedDateTimeISO(CALENDAR_ZONE);
  return { day: value.toPlainDate().toString(), time: value.toPlainTime().toString({ smallestUnit: 'minute' }) };
}
export function atVietnam(day: string, time: string) {
  return Temporal.PlainDate.from(day).toPlainDateTime(Temporal.PlainTime.from(time)).toZonedDateTime(CALENDAR_ZONE).toInstant().toString();
}
export function calendarInstant(dateStr: string, allDay: boolean, fallbackTime: string): string {
  if (allDay || dateStr.length <= 10) return atVietnam(dateStr.slice(0, 10), fallbackTime);
  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(dateStr)) return Temporal.Instant.from(new Date(dateStr).toISOString()).toString();
  return atVietnam(dateStr.slice(0, 10), dateStr.slice(11, 16));
}
export function todayVietnam() { return Temporal.Now.zonedDateTimeISO(CALENDAR_ZONE).toPlainDate().toString(); }
export function tomorrowVietnam() { return Temporal.PlainDate.from(todayVietnam()).add({ days: 1 }).toString(); }
export function endOfTour(start: string, days: number) { return new Date(Date.parse(start) + days * 86_400_000).toISOString(); }
export function weeklyDates(from: string, until: string, weekdays: number[], time: string) {
  if (!weekdays.length) throw new Error('Chọn ít nhất một ngày trong tuần.');
  let cursor = Temporal.PlainDate.from(from);
  const end = Temporal.PlainDate.from(until);
  if (Temporal.PlainDate.compare(cursor, end) > 0) throw new Error('Ngày kết thúc phải từ ngày bắt đầu trở đi.');
  const dates: string[] = [];
  while (Temporal.PlainDate.compare(cursor, end) <= 0) {
    if (weekdays.includes(cursor.dayOfWeek)) {
      dates.push(atVietnam(cursor.toString(), time));
      if (dates.length > 200) throw new Error('Mỗi tour có tối đa 200 đợt khởi hành. Hãy rút ngắn khoảng ngày.');
    }
    cursor = cursor.add({ days: 1 });
  }
  if (!dates.length) throw new Error('Khoảng ngày này không có thứ đã chọn.');
  return dates;
}
export function rememberTimeKey(agencyId: string) { return `tripri:agency:${agencyId}:calendarStartTime`; }
export function readRememberedTime(agencyId: string) {
  try { const value = localStorage.getItem(rememberTimeKey(agencyId)); return value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : '08:00'; }
  catch { return '08:00'; }
}
export function rememberTime(agencyId: string, time: string) {
  try { localStorage.setItem(rememberTimeKey(agencyId), time); } catch { /* Private browsing can disable storage. */ }
}
export const EVENT_COLORS = [
  { background: '#e3f3ee', border: '#9fcab9', text: '#155f4c' },
  { background: '#e9effc', border: '#b0c2e4', text: '#284e89' },
  { background: '#f3eafb', border: '#ccb2e5', text: '#69418b' },
  { background: '#fff0df', border: '#e4bc8c', text: '#85501b' },
  { background: '#fbe9ef', border: '#e5b3c4', text: '#903c5a' },
  { background: '#e6f1f4', border: '#aacbd4', text: '#285f70' },
] as const;
export function tourColor(id: string) {
  const hash = Array.from(id).reduce((value, letter) => ((value * 31 + letter.charCodeAt(0)) >>> 0), 0);
  return EVENT_COLORS[hash % EVENT_COLORS.length];
}
/** Computes peak overlapping event count within [from, to) to size timeGrid day columns. */
export function maxConcurrentEvents(events: Array<{ date: string; end: string }>, from: string, to: string): number {
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs >= toMs) return 1;
  const points: Array<{ ms: number; delta: 1 | -1 }> = [];
  for (const event of events) {
    const start = Math.max(Date.parse(event.date), fromMs);
    const end = Math.min(Date.parse(event.end), toMs);
    if (Number.isFinite(start) && Number.isFinite(end) && start < end) {
      points.push({ ms: start, delta: 1 }, { ms: end, delta: -1 });
    }
  }
  points.sort((a, b) => a.ms - b.ms || a.delta - b.delta);
  let active = 0;
  let peak = 1;
  for (const point of points) {
    active += point.delta;
    if (active > peak) peak = active;
  }
  return peak;
}
