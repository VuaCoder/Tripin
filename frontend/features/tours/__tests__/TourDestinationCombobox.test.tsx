import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { TourDestinationCombobox } from '../components/TourDestinationCombobox';

afterEach(cleanup);

describe('TourDestinationCombobox', () => {
  it('renders search input with placeholder', () => {
    const onChange = vi.fn();
    render(<TourDestinationCombobox id="test-dest" value="" onChange={onChange} />);

    const input = screen.getByRole('textbox');
    expect(input).toBeDefined();
    expect(input.getAttribute('placeholder')).toContain('Hà Giang');
  });

  it('opens popup on focus and shows clean 1-row popular provinces and other option', () => {
    const onChange = vi.fn();
    render(<TourDestinationCombobox id="test-dest" value="" onChange={onChange} />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    expect(screen.getByRole('button', { name: /Đà Nẵng/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Điểm đến khác/i })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /Đà Nẵng/i }));
    expect(onChange).toHaveBeenCalledWith('Đà Nẵng');
  });

  it('filters 63 provinces by landmark/alias when typing (e.g. Sa Pa -> Lào Cai)', () => {
    const onChange = vi.fn();
    render(<TourDestinationCombobox id="test-dest" value="Sa Pa" onChange={onChange} />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    // Should find and display Lào Cai
    const laoCaiOption = screen.getByRole('button', { name: /Lào Cai/i });
    expect(laoCaiOption).toBeDefined();
    fireEvent.click(laoCaiOption);
    expect(onChange).toHaveBeenCalledWith('Lào Cai');
  });

  it('shows custom option only when typing text not in standard provinces', () => {
    const onChange = vi.fn();
    render(<TourDestinationCombobox id="test-dest" value="Bangkok" onChange={onChange} />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    const customOption = screen.getByRole('button', { name: /Điểm đến khác: "Bangkok"/i });
    expect(customOption).toBeDefined();

    fireEvent.click(customOption);
    expect(onChange).toHaveBeenCalledWith('Bangkok');
  });

  it('does NOT show custom option when typing an exact standard province name', () => {
    const onChange = vi.fn();
    render(<TourDestinationCombobox id="test-dest" value="Đà Nẵng" onChange={onChange} />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    // Standard province button should be there
    expect(screen.getByRole('button', { name: /Đà Nẵng/i })).toBeDefined();
    // Custom "Điểm đến khác" prompt should NOT show for exact matches
    expect(screen.queryByRole('button', { name: /Điểm đến khác: "Đà Nẵng"/i })).toBeNull();
  });

  it('accurately ranks Đà Nẵng at top when searching "đà" without random North provinces', () => {
    const onChange = vi.fn();
    render(<TourDestinationCombobox id="test-dest" value="đà" onChange={onChange} />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    const dropdownButtons = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-label') !== 'Xoá điểm đến');
    // Top 1 province must be Đà Nẵng
    expect(dropdownButtons[0].textContent).toContain('Đà Nẵng');
    // Random substring matches like Hải Phòng, Quảng Ninh must NOT match
    expect(screen.queryByRole('button', { name: /^Hải Phòng$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Quảng Ninh$/i })).toBeNull();
  });

  it('accurately ranks Hải Phòng and Hải Dương when searching "hải" without Thái Bình or Thái Nguyên', () => {
    const onChange = vi.fn();
    render(<TourDestinationCombobox id="test-dest" value="hải" onChange={onChange} />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    const dropdownButtons = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-label') !== 'Xoá điểm đến');
    const matchedNames = dropdownButtons.map((b) => b.textContent?.trim());
    expect(matchedNames).toContain('Hải Phòng');
    expect(matchedNames).toContain('Hải Dương');
    // Thái Bình / Thái Nguyên must NOT match
    expect(screen.queryByRole('button', { name: /^Thái Bình$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Thái Nguyên$/i })).toBeNull();
  });

  it('clears selection when clicking X button', () => {
    const onChange = vi.fn();
    render(<TourDestinationCombobox id="test-dest" value="Hà Nội" onChange={onChange} />);

    const clearBtn = screen.getByRole('button', { name: 'Xoá điểm đến' });
    fireEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith('');
  });
});
