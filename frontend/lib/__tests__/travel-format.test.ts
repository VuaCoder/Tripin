import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { formatSmartDate, formatSmartDateTime } from '../travel-format';

describe('Smart Date & DateTime formatters', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Giả lập thời điểm hiện tại là 13/11/2026 15:30:00
    vi.setSystemTime(new Date('2026-11-13T15:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatSmartDate', () => {
    it('returns "—" for falsy or invalid values', () => {
      expect(formatSmartDate(null)).toBe('—');
      expect(formatSmartDate(undefined)).toBe('—');
      expect(formatSmartDate('')).toBe('—');
      expect(formatSmartDate('invalid-date')).toBe('—');
    });

    it('formats as DD/MM for dates in the current year (2026)', () => {
      const date1 = new Date(2026, 10, 15); // 15/11/2026
      expect(formatSmartDate(date1)).toBe('15/11');

      const date2 = new Date(2026, 0, 5); // 05/01/2026
      expect(formatSmartDate(date2)).toBe('05/01');
    });

    it('formats as DD/MM/YY for dates in previous years', () => {
      const datePast1 = new Date(2025, 11, 20); // 20/12/2025
      expect(formatSmartDate(datePast1)).toBe('20/12/25');

      const datePast2 = new Date(2024, 2, 10); // 10/03/2024
      expect(formatSmartDate(datePast2)).toBe('10/03/24');
    });

    it('formats as DD/MM/YY for dates in future years', () => {
      const dateFuture = new Date(2027, 0, 1); // 01/01/2027
      expect(formatSmartDate(dateFuture)).toBe('01/01/27');
    });
  });

  describe('formatSmartDateTime', () => {
    it('returns "—" for falsy or invalid values', () => {
      expect(formatSmartDateTime(null)).toBe('—');
      expect(formatSmartDateTime(undefined)).toBe('—');
      expect(formatSmartDateTime('')).toBe('—');
      expect(formatSmartDateTime('invalid-date')).toBe('—');
    });

    it('formats as HH:MM - DD/MM for dates in the current year', () => {
      const date1 = new Date(2026, 10, 15, 9, 30);
      expect(formatSmartDateTime(date1)).toBe('09:30 - 15/11');

      const date2 = new Date(2026, 0, 5, 14, 5);
      expect(formatSmartDateTime(date2)).toBe('14:05 - 05/01');
    });

    it('formats as HH:MM - DD/MM/YY for dates in different years', () => {
      const datePast = new Date(2025, 11, 20, 8, 15);
      expect(formatSmartDateTime(datePast)).toBe('08:15 - 20/12/25');

      const dateFuture = new Date(2027, 0, 1, 10, 0);
      expect(formatSmartDateTime(dateFuture)).toBe('10:00 - 01/01/27');
    });
  });
});

