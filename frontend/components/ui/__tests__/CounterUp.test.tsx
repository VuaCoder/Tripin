import { render, screen, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { CounterUp, useCountUp } from '../CounterUp';

describe('CounterUp and useCountUp', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders initial value formatted with defaults', () => {
    render(<CounterUp value={100} duration={100} />);
    expect(screen.getByText('100')).toBeDefined();
  });

  it('renders with prefix, suffix and decimals', () => {
    render(
      <CounterUp
        value={15.5}
        decimals={1}
        duration={100}
        prefix="Mức: "
        suffix="%"
      />
    );
    expect(screen.getByText('Mức: 15.5%')).toBeDefined();
  });

  it('renders with custom formatter for VND currency', () => {
    const formatter = (val: number) => `${val.toLocaleString('vi-VN')} ₫`;
    render(<CounterUp value={500000} duration={100} formatter={formatter} />);
    expect(screen.getByText(/500\.000/)).toBeDefined();
  });

  it('animates towards the new value when value prop changes', () => {
    const { rerender } = render(<CounterUp value={10} duration={500} />);
    expect(screen.getByText('10')).toBeDefined();

    rerender(<CounterUp value={20} duration={500} />);
    // Advance half duration
    act(() => {
      vi.advanceTimersByTime(250);
    });
    // Advance remainder
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByText('20')).toBeDefined();
  });
});
