import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AntDateRangePicker } from '../AntDateRangePicker';

afterEach(cleanup);

describe('AntDateRangePicker', () => {
  it('displays "Ngày ... → Ngày ..." on a single line without "Đã chọn dải ngày" when range is selected', () => {
    const { container } = render(
      <AntDateRangePicker
        startDate="2026-11-11"
        endDate="2026-11-20"
        onChange={vi.fn()}
      />
    );

    const trigger = container.querySelector('[aria-haspopup="dialog"]');
    expect(trigger).not.toBeNull();
    fireEvent.click(trigger!);

    expect(screen.queryByText(/Đã chọn dải ngày/i)).toBeNull();
    expect(screen.getByText('Ngày 11/11/2026 → Ngày 20/11/2026')).toBeDefined();
  });

  it('guides picking start and end dates when range is incomplete', () => {
    const { container, rerender } = render(
      <AntDateRangePicker startDate={undefined} endDate={undefined} onChange={vi.fn()} />
    );

    const trigger = container.querySelector('[aria-haspopup="dialog"]');
    fireEvent.click(trigger!);
    expect(screen.getByText('Chọn ngày bắt đầu')).toBeDefined();

    rerender(<AntDateRangePicker startDate="2026-11-11" endDate={undefined} onChange={vi.fn()} />);
    expect(screen.getByText('Chọn ngày kết thúc')).toBeDefined();
    expect(screen.getAllByText('11/11/2026').length).toBeGreaterThanOrEqual(2);
  });
});

