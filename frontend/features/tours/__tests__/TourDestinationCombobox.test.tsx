import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { TourDestinationCombobox } from '../components/TourDestinationCombobox';
import { useState } from 'react';

afterEach(cleanup);

describe('TourDestinationCombobox', () => {
  it('does not validate between pressing a suggestion and selecting it on the first click', () => {
    const onBlur = vi.fn();
    function Form() {
      const [value, setValue] = useState('');
      const [error, setError] = useState(false);
      return <TourDestinationCombobox id="destination" value={value} onChange={setValue}
        onBlur={() => { onBlur(value); setError(!value.trim()); }}
        hint={error ? <p role="alert">Destination is required</p> : null} />;
    }
    render(<Form />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    const option = screen.getByRole('button', { name: /^Hà Nội$/ });
    // Browsers blur the input before dispatching the option's click.
    fireEvent.blur(input, { relatedTarget: option });
    expect(onBlur).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(option);
    expect((input as HTMLInputElement).value).toBe('Hà Nội');
    expect(screen.queryByRole('button', { name: /^Hà Nội$/ })).toBeNull();
    fireEvent.blur(input, { relatedTarget: document.body });
    expect(onBlur).toHaveBeenCalledWith('Hà Nội');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('still validates an empty input when focus leaves the whole picker', () => {
    const onBlur = vi.fn();
    render(<TourDestinationCombobox id="destination" value="" onChange={vi.fn()} onBlur={onBlur} />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.blur(input, { relatedTarget: document.body });
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /^Hà Nội$/ })).toBeNull();
  });

  it('keeps focus during the primary mouse press and selects only on click', () => {
    const onChange = vi.fn();
    render(<TourDestinationCombobox id="destination" value="" onChange={onChange} />);
    fireEvent.focus(screen.getByRole('textbox'));
    const option = screen.getByRole('button', { name: /^Hà Nội$/ });
    expect(fireEvent.mouseDown(option, { button: 0 })).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
    expect(fireEvent.mouseDown(option, { button: 2 })).toBe(true);
    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledExactlyOnceWith('Hà Nội');
  });

  it('supports keyboard selection without premature validation', () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(<TourDestinationCombobox id="destination" value="" onChange={onChange} onBlur={onBlur} />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledExactlyOnceWith('Hà Nội');
    expect(onBlur).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /^Hà Nội$/ })).toBeNull();
  });

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
