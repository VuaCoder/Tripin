import { describe, it, expect, vi } from 'vitest';
import {
  formatPromotionCode,
  handlePromotionCodeKeyDown,
  handlePromotionCodeChange,
} from '../codeHelper';

describe('codeHelper', () => {
  describe('formatPromotionCode', () => {
    it('converts spaces to underscores and characters to uppercase', () => {
      expect(formatPromotionCode('ma dinh danh')).toBe('MA_DINH_DANH');
      expect(formatPromotionCode('he 2026')).toBe('HE_2026');
      expect(formatPromotionCode('tet-2026 vip 01')).toBe('TET-2026_VIP_01');
    });

    it('converts multiple spaces to multiple underscores faithfully preserving length', () => {
      expect(formatPromotionCode('ma  dinh')).toBe('MA__DINH');
    });

    it('preserves existing hyphens and underscores', () => {
      expect(formatPromotionCode('SUMMER_2026-A')).toBe('SUMMER_2026-A');
    });

    it('converts tabs and newlines if present', () => {
      expect(formatPromotionCode('PROMO\tCODE\n')).toBe('PROMO_CODE_');
    });
  });

  describe('handlePromotionCodeKeyDown', () => {
    it('intercepts space key, prevents default, and inserts underscore at cursor position', () => {
      const onChange = vi.fn();
      const preventDefault = vi.fn();

      const input = document.createElement('input');
      input.value = 'MADINH';
      input.selectionStart = 2;
      input.selectionEnd = 2;

      const event = {
        key: ' ',
        preventDefault,
        currentTarget: input,
      } as unknown as React.KeyboardEvent<HTMLInputElement>;

      handlePromotionCodeKeyDown(event, onChange);

      expect(preventDefault).toHaveBeenCalledOnce();
      expect(onChange).toHaveBeenCalledWith('MA_DINH');
    });

    it('does nothing when a non-space key is pressed', () => {
      const onChange = vi.fn();
      const preventDefault = vi.fn();

      const input = document.createElement('input');
      input.value = 'MA';

      const event = {
        key: 'A',
        preventDefault,
        currentTarget: input,
      } as unknown as React.KeyboardEvent<HTMLInputElement>;

      handlePromotionCodeKeyDown(event, onChange);

      expect(preventDefault).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('replaces selection range with underscore if text is selected', () => {
      const onChange = vi.fn();
      const preventDefault = vi.fn();

      const input = document.createElement('input');
      input.value = 'MA_OLD_CODE';
      input.selectionStart = 3;
      input.selectionEnd = 6; // selecting "OLD"

      const event = {
        key: ' ',
        preventDefault,
        currentTarget: input,
      } as unknown as React.KeyboardEvent<HTMLInputElement>;

      handlePromotionCodeKeyDown(event, onChange);

      expect(preventDefault).toHaveBeenCalledOnce();
      expect(onChange).toHaveBeenCalledWith('MA___CODE');
    });
  });

  describe('handlePromotionCodeChange', () => {
    it('formats pasted string containing spaces into uppercase with underscores', () => {
      const onChange = vi.fn();

      const input = document.createElement('input');
      input.value = 'ma dinh danh';
      input.selectionStart = 12;

      const event = {
        target: input,
      } as unknown as React.ChangeEvent<HTMLInputElement>;

      handlePromotionCodeChange(event, onChange);

      expect(onChange).toHaveBeenCalledWith('MA_DINH_DANH');
    });
  });
});
