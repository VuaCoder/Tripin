import { describe, expect, it } from 'vitest';
import { dayLabel, inboxTime, preview } from '../presentation';

describe('chat presentation in the device timezone', () => {
  const now = new Date(2026, 9, 24, 13, 30);
  it('uses time today, yesterday, calendar dates a week ago and years when needed', () => {
    expect(inboxTime(new Date(2026, 9, 24, 9, 5).toISOString(), now)).toBe('09:05');
    expect(inboxTime(new Date(2026, 9, 23, 23, 59).toISOString(), now)).toBe('Hôm qua');
    expect(inboxTime(new Date(2026, 9, 17).toISOString(), now)).toBe('17/10');
    expect(inboxTime(new Date(2025, 9, 17).toISOString(), now)).toBe('17/10/2025');
    expect(dayLabel(new Date(2026, 9, 17).toISOString(), now)).toBe('17/10/2026');
  });
  it('changes day labels across midnight and the year boundary', () => {
    const message = new Date(2026, 11, 31, 23, 59).toISOString();
    expect(dayLabel(message, new Date(2026, 11, 31, 23, 59))).toBe('Hôm nay');
    expect(dayLabel(message, new Date(2027, 0, 1, 0, 1))).toBe('Hôm qua');
  });
  it('converts rich content into a single plain preview', () => {
    expect(preview('## **Đà Nẵng**\n- Đi [Hội An](https://example.com)\n`hôm nay`')).toBe('Đà Nẵng Đi Hội An hôm nay');
    expect(preview('<b>Xin chào</b>\n\nBạn')).toBe('Xin chào Bạn');
  });
});
