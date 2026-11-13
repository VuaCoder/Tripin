import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TimeWheelPicker,
  TimePicker,
  TimeWheelModal,
  formatToTimeValue,
  parseTimeTo12h,
} from '../TimeWheelPicker';

afterEach(cleanup);

describe('TimeWheelPicker helpers', () => {
  it('parses 12h formatted string correctly', () => {
    expect(parseTimeTo12h('08:30 AM')).toEqual({ hour: 8, minute: 30, period: 'AM' });
    expect(parseTimeTo12h('11:05 PM')).toEqual({ hour: 11, minute: 5, period: 'PM' });
    expect(parseTimeTo12h('12:00 PM')).toEqual({ hour: 12, minute: 0, period: 'PM' });
  });

  it('parses 24h formatted string correctly into 12h format', () => {
    expect(parseTimeTo12h('14:20')).toEqual({ hour: 2, minute: 20, period: 'PM' });
    expect(parseTimeTo12h('00:45')).toEqual({ hour: 12, minute: 45, period: 'AM' });
    expect(parseTimeTo12h('09:15')).toEqual({ hour: 9, minute: 15, period: 'AM' });
  });

  it('formats time to 12h and 24h output accurately', () => {
    const valAM = formatToTimeValue(8, 5, 'AM');
    expect(valAM.formatted).toBe('08:05 AM');
    expect(valAM.time24).toBe('08:05');

    const valPM = formatToTimeValue(8, 30, 'PM');
    expect(valPM.formatted).toBe('08:30 PM');
    expect(valPM.time24).toBe('20:30');

    const val12AM = formatToTimeValue(12, 0, 'AM');
    expect(val12AM.formatted).toBe('12:00 AM');
    expect(val12AM.time24).toBe('00:00');

    const val12PM = formatToTimeValue(12, 45, 'PM');
    expect(val12PM.formatted).toBe('12:45 PM');
    expect(val12PM.time24).toBe('12:45');
  });
});

describe('TimeWheelPicker Component', () => {
  it('renders 3 columns: hour, minute, period with colon separator', () => {
    render(<TimeWheelPicker defaultValue="08:30 AM" />);

    expect(screen.getByRole('slider', { name: /chọn giờ/i })).toBeDefined();
    expect(screen.getByRole('slider', { name: /chọn phút/i })).toBeDefined();
    expect(screen.getByRole('slider', { name: /chọn buổi/i })).toBeDefined();
    expect(screen.getByText(':')).toBeDefined();
  });

  it('displays real-time preview text at bottom', () => {
    render(<TimeWheelPicker value="08:30 AM" />);

    expect(screen.getByText(/Thời gian đã chọn:/i)).toBeDefined();
    expect(screen.getByText('08:30 AM')).toBeDefined();
  });

  it('supports keyboard navigation on columns', () => {
    const handleChange = vi.fn();
    render(<TimeWheelPicker defaultValue="08:30 AM" onChange={handleChange} />);

    const periodSlider = screen.getByRole('slider', { name: /chọn buổi/i });
    fireEvent.keyDown(periodSlider, { key: 'ArrowDown' });

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        period: 'PM',
        formatted: '08:30 PM',
        time24: '20:30',
      })
    );
  });

  it('allows clicking an item to select it', () => {
    const handleChange = vi.fn();
    render(<TimeWheelPicker defaultValue="08:30 AM" onChange={handleChange} />);

    // Click PM
    const pmItem = screen.getByText('PM');
    fireEvent.click(pmItem);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        period: 'PM',
      })
    );
  });

  it('hides preview text when showPreviewText is false', () => {
    render(<TimeWheelPicker defaultValue="08:30 AM" showPreviewText={false} />);
    expect(screen.queryByText(/Thời gian đã chọn:/i)).toBeNull();
  });
});

describe('TimePicker Form Input', () => {
  it('renders input trigger with placeholder', () => {
    render(<TimePicker placeholder="Chọn giờ khởi hành..." />);
    expect(screen.getByText('Chọn giờ khởi hành...')).toBeDefined();
  });

  it('opens wheel popover on click and closes on "Xong"', () => {
    render(<TimePicker defaultValue="09:15 AM" />);
    const trigger = screen.getByRole('button', { name: /09:15 AM/i });

    // Open popover
    fireEvent.click(trigger);
    expect(screen.getByRole('slider', { name: /chọn giờ/i })).toBeDefined();

    // Close on Xong
    const doneBtn = screen.getByRole('button', { name: /Xong/i });
    fireEvent.click(doneBtn);
    expect(screen.queryByRole('slider', { name: /chọn giờ/i })).toBeNull();
  });

  it('allows clearing value via clear button', () => {
    const handleChange = vi.fn();
    render(<TimePicker defaultValue="09:15 AM" onChange={handleChange} />);

    const clearBtn = screen.getByLabelText(/Xóa thời gian/i);
    fireEvent.click(clearBtn);

    expect(handleChange).toHaveBeenCalledWith('', expect.anything());
  });
});

describe('TimeWheelModal', () => {
  it('renders modal with wheel picker and confirms value', () => {
    const handleConfirm = vi.fn();
    const handleClose = vi.fn();

    render(
      <TimeWheelModal
        open={true}
        onClose={handleClose}
        title="Chọn giờ hẹn"
        value="10:30 AM"
        onConfirm={handleConfirm}
      />
    );

    expect(screen.getByText('Chọn giờ hẹn')).toBeDefined();
    expect(screen.getByText('10:30 AM')).toBeDefined();

    const confirmBtn = screen.getByRole('button', { name: /Xác nhận/i });
    fireEvent.click(confirmBtn);

    expect(handleConfirm).toHaveBeenCalledWith('10:30 AM', expect.anything());
  });
});

