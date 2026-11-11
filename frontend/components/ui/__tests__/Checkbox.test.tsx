import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Checkbox } from '../Checkbox';

describe('Checkbox', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders label and toggles checked state', () => {
    const handleChange = vi.fn();
    render(<Checkbox checked={false} onChange={handleChange} label="Agree to terms" />);

    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);
    expect(handleChange).toHaveBeenCalledWith(true, expect.any(Object));
  });

  it('renders error message when provided', () => {
    render(<Checkbox checked={false} error="Field is required" label="Accept" />);
    expect(screen.getByText('Field is required')).toBeDefined();
  });

  it('is disabled when disabled prop is set', () => {
    render(<Checkbox disabled label="Disabled checkbox" />);
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
  });
});
