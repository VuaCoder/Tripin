import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BackButton } from '../BackButton';

const mockPush = vi.fn();
const mockBack = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
}));

describe('BackButton', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockBack.mockReset();
  });

  afterEach(cleanup);

  it('renders with default label as aria-label and chevron icon', () => {
    render(<BackButton />);
    expect(screen.getByRole('button', { name: 'Quay lại' })).toBeTruthy();
    expect(screen.getByText('chevron_left')).toBeTruthy();
  });

  it('renders with custom label', () => {
    render(<BackButton label="Quay lại danh sách" />);
    expect(screen.getByRole('button', { name: 'Quay lại danh sách' })).toBeTruthy();
  });

  it('renders visible text when showLabel is true', () => {
    render(<BackButton showLabel label="Quay lại" />);
    expect(screen.getByRole('button', { name: 'Quay lại' })).toBeTruthy();
    expect(screen.getByText('Quay lại')).toBeTruthy();
  });

  it('calls custom onClick when provided', () => {
    const handleCustomClick = vi.fn();
    render(<BackButton onClick={handleCustomClick} />);

    fireEvent.click(screen.getByRole('button'));
    expect(handleCustomClick).toHaveBeenCalledTimes(1);
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('calls router.back when history length is greater than 1', () => {
    Object.defineProperty(window, 'history', {
      value: { length: 2 },
      writable: true,
    });

    render(<BackButton fallbackUrl="/tours" />);
    fireEvent.click(screen.getByRole('button'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('falls back to fallbackUrl when history is not available', () => {
    Object.defineProperty(window, 'history', {
      value: { length: 1 },
      writable: true,
    });

    render(<BackButton fallbackUrl="/tours" />);
    fireEvent.click(screen.getByRole('button'));

    expect(mockPush).toHaveBeenCalledWith('/tours');
  });
});
