import { describe, expect, it } from 'vitest';
import {
  getPassengerAgeGroup,
  getPassengerAgeRangeLabel,
  validatePassengerAge,
} from '../utils/passengerValidation';

describe('passengerValidation', () => {
  const currentTourYear = 2026;

  describe('getPassengerAgeGroup', () => {
    const guests = { adults: 2, children: 1, infants: 1 };

    it('identifies adults, children, and infants by index', () => {
      expect(getPassengerAgeGroup(0, guests)).toBe('ADULT');
      expect(getPassengerAgeGroup(1, guests)).toBe('ADULT');
      expect(getPassengerAgeGroup(2, guests)).toBe('CHILD');
      expect(getPassengerAgeGroup(3, guests)).toBe('INFANT');
    });
  });

  describe('getPassengerAgeRangeLabel', () => {
    it('returns formatted ranges for default age pricing', () => {
      const child = getPassengerAgeRangeLabel('CHILD', currentTourYear);
      expect(child.rangeText).toBe('Độ tuổi 2 – 12');

      const infant = getPassengerAgeRangeLabel('INFANT', currentTourYear);
      expect(infant.rangeText).toBe('Dưới 2 tuổi');

      const adult = getPassengerAgeRangeLabel('ADULT', currentTourYear);
      expect(adult.rangeText).toBe('Từ 13 tuổi trở lên');
    });
  });

  describe('validatePassengerAge', () => {
    it('returns null when birthYear is empty or whitespace', () => {
      expect(validatePassengerAge('', 'CHILD', currentTourYear)).toBeNull();
      expect(validatePassengerAge('   ', 'CHILD', currentTourYear)).toBeNull();
    });

    it('rejects non-4-digit strings', () => {
      expect(validatePassengerAge('99', 'CHILD', currentTourYear)).toContain('phải gồm 4 chữ số');
      expect(validatePassengerAge('2000a', 'CHILD', currentTourYear)).toContain('phải gồm 4 chữ số');
    });

    it('rejects out of bounds years (< 1900 or > tourYear)', () => {
      expect(validatePassengerAge('1899', 'ADULT', currentTourYear)).toContain('từ 1900 đến 2026');
      expect(validatePassengerAge('2027', 'INFANT', currentTourYear)).toContain('từ 1900 đến 2026');
    });

    it('validates CHILD tickets correctly', () => {
      // 2000 in 2026 is 26 years old -> exceeds child limit!
      const error2000 = validatePassengerAge('2000', 'CHILD', currentTourYear);
      expect(error2000).toContain('áp dụng từ 2 – 12 tuổi');
      expect(error2000).toContain('26 tuổi');
      expect(error2000).toContain('đổi sang vé Người lớn');

      // 2018 in 2026 is 8 years old -> valid child
      expect(validatePassengerAge('2018', 'CHILD', currentTourYear)).toBeNull();

      // 2014 in 2026 is 12 years old -> valid child (boundary)
      expect(validatePassengerAge('2014', 'CHILD', currentTourYear)).toBeNull();

      // 2013 in 2026 is 13 years old -> exceeds child limit!
      expect(validatePassengerAge('2013', 'CHILD', currentTourYear)).toContain('đổi sang vé Người lớn');

      // 2025 in 2026 is 1 year old -> infant, not child!
      const error2025 = validatePassengerAge('2025', 'CHILD', currentTourYear);
      expect(error2025).toContain('thuộc nhóm vé Em bé');
    });

    it('validates INFANT tickets correctly', () => {
      // 2025 in 2026 is 1 year old -> valid infant (< 2)
      expect(validatePassengerAge('2025', 'INFANT', currentTourYear)).toBeNull();
      // 2026 in 2026 is 0 years old -> valid infant
      expect(validatePassengerAge('2026', 'INFANT', currentTourYear)).toBeNull();

      // 2024 in 2026 is 2 years old -> >= 2, must be child!
      const error2024 = validatePassengerAge('2024', 'INFANT', currentTourYear);
      expect(error2024).toContain('dưới 2 tuổi');
      expect(error2024).toContain('đổi sang vé Trẻ em / Người lớn');
    });

    it('validates ADULT tickets correctly', () => {
      // 1990 in 2026 is 36 years old -> valid adult
      expect(validatePassengerAge('1990', 'ADULT', currentTourYear)).toBeNull();

      // 2018 in 2026 is 8 years old -> under 13, invalid for adult ticket
      const error2018 = validatePassengerAge('2018', 'ADULT', currentTourYear);
      expect(error2018).toContain('từ 13 tuổi trở lên');
      expect(error2018).toContain('đổi sang vé Trẻ em');
    });

    it('respects custom agePricing limits', () => {
      const customPricing = {
        childMinAge: 3,
        adultMinAge: 16,
        childPercent: 50,
        infantPercent: 0,
      };

      // In this tour, child is 3-15
      // 14 years old (born 2012) is valid child
      expect(validatePassengerAge('2012', 'CHILD', currentTourYear, customPricing)).toBeNull();
      // 16 years old (born 2010) is too old for child
      expect(validatePassengerAge('2010', 'CHILD', currentTourYear, customPricing)).toContain('đổi sang vé Người lớn');
      // 2 years old (born 2024) is infant for this tour
      expect(validatePassengerAge('2024', 'CHILD', currentTourYear, customPricing)).toContain('thuộc nhóm vé Em bé');
    });
  });
});
